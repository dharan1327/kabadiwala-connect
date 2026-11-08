from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..auth import get_current_user, require_roles
from ..constants import STAGE_LABELS
from ..database import get_db
from ..models import MaterialLot, MaterialTransfer, Organization, Transaction, TrackingEvent, User, utcnow
from ..schemas import DispatchIn, ProcessIn, PurchaseIn, ReceiveIn
from ..serializers import lot_out, transaction_out
from ..utils import add_event, audit, current_reference_price, iso, notify

router = APIRouter(tags=["market"])


def _authorized_org(user: User, kind: str) -> Organization:
    org = user.organization
    if org is None or org.kind != kind:
        raise HTTPException(status_code=403, detail=f"Only {kind} organisations can do this")
    if not org.authorized:
        raise HTTPException(status_code=403, detail="Your organisation is awaiting admin authorisation")
    return org


def _lot_or_404(db: Session, lot_id: int) -> MaterialLot:
    lot = db.get(MaterialLot, lot_id)
    if lot is None:
        raise HTTPException(status_code=404, detail="Material lot not found")
    return lot


def _role_of(db: Session, user_id: Optional[int]) -> Optional[str]:
    if user_id is None:
        return None
    u = db.get(User, user_id)
    return u.role if u else None


# ---------- transactions and tracking ----------
@router.get("/transactions/mine")
def my_transactions(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    q = db.query(Transaction)
    if user.role == "household":
        q = q.filter(Transaction.household_id == user.id)
    elif user.role == "collector":
        q = q.filter(Transaction.collector_id == user.id)
    elif user.role != "admin":
        raise HTTPException(status_code=403, detail="Transactions are not shown for your role")
    return [transaction_out(t) for t in q.order_by(Transaction.created_at.desc()).all()]


@router.get("/transactions/{txn_id}")
def transaction_detail(txn_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    txn = db.get(Transaction, txn_id)
    if txn is None:
        raise HTTPException(status_code=404, detail="Transaction not found")
    lot = db.query(MaterialLot).filter(MaterialLot.transaction_id == txn.id).first()
    allowed = (user.role == "admin" or user.id in (txn.household_id, txn.collector_id)
               or (lot is not None and user.id in (lot.dealer_id, lot.recycler_id)))
    if not allowed:
        raise HTTPException(status_code=403, detail="You do not have access to this transaction")
    events = (db.query(TrackingEvent)
              .filter(or_(TrackingEvent.request_id == txn.request_id,
                          TrackingEvent.lot_id == (lot.id if lot else -1)))
              .order_by(TrackingEvent.created_at, TrackingEvent.id).all())
    timeline = [{"stage": e.stage, "label": STAGE_LABELS.get(e.stage, e.stage), "note": e.note,
                 "actor_role": _role_of(db, e.actor_id), "at": iso(e.created_at)} for e in events]
    return {"transaction": transaction_out(txn), "lot": lot_out(db, lot) if lot else None, "timeline": timeline}


# ---------- dealer ----------
@router.get("/market/recyclers")
def authorized_recyclers(user: User = Depends(require_roles("dealer", "admin")), db: Session = Depends(get_db)):
    rows = (db.query(Organization).filter(Organization.kind == "recycler", Organization.authorized.is_(True)).all())
    return [{"id": o.user_id, "name": o.name, "city": o.user.city} for o in rows]


@router.get("/market/lots")
def available_lots(category: Optional[str] = None, city: Optional[str] = None,
                   user: User = Depends(require_roles("dealer")), db: Session = Depends(get_db)):
    _authorized_org(user, "dealer")
    q = db.query(MaterialLot).filter(MaterialLot.status == "available")
    if category:
        q = q.filter(MaterialLot.category == category)
    out = []
    for lot in q.order_by(MaterialLot.created_at.desc()).all():
        item = lot_out(db, lot)
        if city and city.strip().lower() not in (item["collector_city"] or "").lower():
            continue
        item["reference_price_per_kg"] = current_reference_price(db, lot.category)
        out.append(item)
    return out


@router.get("/market/dealer/inventory")
def dealer_inventory(user: User = Depends(require_roles("dealer")), db: Session = Depends(get_db)):
    _authorized_org(user, "dealer")
    lots = db.query(MaterialLot).filter(MaterialLot.dealer_id == user.id).order_by(MaterialLot.updated_at.desc()).all()
    return [lot_out(db, lot) for lot in lots]


@router.post("/market/lots/{lot_id}/purchase")
def purchase_lot(lot_id: int, body: PurchaseIn, user: User = Depends(require_roles("dealer")),
                 db: Session = Depends(get_db)):
    _authorized_org(user, "dealer")
    lot = _lot_or_404(db, lot_id)
    if lot.status != "available":
        raise HTTPException(status_code=409, detail="This lot is no longer available")
    txn = db.get(Transaction, lot.transaction_id)
    lot.status, lot.dealer_id, lot.purchase_price_per_kg = "purchased", user.id, body.price_per_kg
    lot.updated_at = utcnow()
    db.add(MaterialTransfer(lot_id=lot.id, from_user_id=txn.collector_id, to_user_id=user.id,
                            kind="dealer_purchase", quantity_kg=lot.quantity_kg, price_per_kg=body.price_per_kg))
    add_event(db, "dealer_purchased", user.id, f"₹{body.price_per_kg}/kg", lot_id=lot.id)
    notify(db, txn.collector_id, f"{txn.public_ref}: your material was purchased by a dealer", "/app/collector")
    audit(db, user.id, "lot.purchase", f"lot:{lot.id}", f"₹{body.price_per_kg}/kg")
    db.commit()
    return lot_out(db, lot)


@router.post("/market/lots/{lot_id}/dispatch")
def dispatch_lot(lot_id: int, body: DispatchIn, user: User = Depends(require_roles("dealer")),
                 db: Session = Depends(get_db)):
    _authorized_org(user, "dealer")
    lot = _lot_or_404(db, lot_id)
    if lot.dealer_id != user.id or lot.status != "purchased":
        raise HTTPException(status_code=409, detail="Only purchased lots you own can be dispatched")
    recycler = db.get(User, body.recycler_id)
    if recycler is None or recycler.organization is None or recycler.organization.kind != "recycler" \
            or not recycler.organization.authorized:
        raise HTTPException(status_code=400, detail="Choose an authorised recycling unit")
    lot.recycler_id, lot.status = recycler.id, "dispatched"
    lot.updated_at = utcnow()
    db.add(MaterialTransfer(lot_id=lot.id, from_user_id=user.id, to_user_id=recycler.id,
                            kind="dispatch_to_recycler", quantity_kg=lot.quantity_kg))
    add_event(db, "dispatched_to_recycler", user.id, recycler.organization.name, lot_id=lot.id)
    notify(db, recycler.id, f"New material dispatched to you (lot {lot.id}, {lot.quantity_kg} kg)", "/app/recycler")
    audit(db, user.id, "lot.dispatch", f"lot:{lot.id}", f"to recycler {recycler.id}")
    db.commit()
    return lot_out(db, lot)


# ---------- recycling unit ----------
@router.get("/market/recycler/lots")
def recycler_lots(user: User = Depends(require_roles("recycler")), db: Session = Depends(get_db)):
    _authorized_org(user, "recycler")
    lots = db.query(MaterialLot).filter(MaterialLot.recycler_id == user.id).order_by(MaterialLot.updated_at.desc()).all()
    return [lot_out(db, lot) for lot in lots]


@router.post("/market/lots/{lot_id}/receive")
def receive_lot(lot_id: int, body: ReceiveIn, user: User = Depends(require_roles("recycler")),
                db: Session = Depends(get_db)):
    _authorized_org(user, "recycler")
    lot = _lot_or_404(db, lot_id)
    if lot.recycler_id != user.id or lot.status != "dispatched":
        raise HTTPException(status_code=409, detail="This lot is not awaiting receipt")
    lot.received_quantity_kg, lot.inspection = body.received_quantity_kg, body.inspection
    lot.updated_at = utcnow()
    if body.inspection == "pass":
        lot.status = "received"
        add_event(db, "recycler_received", user.id, f"{body.received_quantity_kg} kg", lot_id=lot.id)
    else:
        lot.status = "rejected"
        add_event(db, "inspection_failed", user.id, "", lot_id=lot.id)
    if lot.dealer_id:
        notify(db, lot.dealer_id, f"Lot {lot.id}: recycling unit inspection {body.inspection}ed", "/app/dealer")
    db.commit()
    return lot_out(db, lot)


@router.post("/market/lots/{lot_id}/process")
def process_lot(lot_id: int, body: ProcessIn, user: User = Depends(require_roles("recycler")),
                db: Session = Depends(get_db)):
    _authorized_org(user, "recycler")
    lot = _lot_or_404(db, lot_id)
    if lot.recycler_id != user.id:
        raise HTTPException(status_code=404, detail="Material lot not found")
    if body.status == "processing":
        if lot.status != "received":
            raise HTTPException(status_code=409, detail="Only received material can enter processing")
        lot.status = "processing"
        add_event(db, "recycling_processing", user.id, "", lot_id=lot.id)
    else:
        # Recycled quantity is recorded only after the recycling unit confirms processing.
        if lot.status != "processing":
            raise HTTPException(status_code=409, detail="Start processing before confirming recycling")
        if body.recycled_quantity_kg is None or body.recycled_quantity_kg > (lot.received_quantity_kg or 0):
            raise HTTPException(status_code=400, detail="Recycled quantity must be entered and cannot exceed the received quantity")
        lot.status = "recycled"
        lot.recycled_quantity_kg = body.recycled_quantity_kg
        add_event(db, "recycled", user.id, f"{body.recycled_quantity_kg} kg", lot_id=lot.id)
        if lot.dealer_id:
            notify(db, lot.dealer_id, f"Lot {lot.id}: recycling confirmed ({body.recycled_quantity_kg} kg)", "/app/dealer")
    lot.updated_at = utcnow()
    db.commit()
    return lot_out(db, lot)
