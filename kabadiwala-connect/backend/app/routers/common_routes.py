from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..auth import get_current_user, require_roles
from ..constants import CATEGORY_LABELS
from ..database import get_db
from ..models import CollectorProfile, Complaint, MaterialLot, Notification, ReferencePrice, ScrapRequest, Transaction, User, utcnow
from ..schemas import ComplaintIn, PriceIn
from ..serializers import average_rating
from ..utils import audit, category_label, iso, latest_reference

router = APIRouter(tags=["common"])


# ---------- notifications ----------
@router.get("/notifications")
def list_notifications(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = (db.query(Notification).filter(Notification.user_id == user.id)
            .order_by(Notification.created_at.desc(), Notification.id.desc()).limit(50).all())
    unread = db.query(Notification).filter(Notification.user_id == user.id, Notification.read.is_(False)).count()
    return {"unread": unread, "items": [
        {"id": n.id, "message": n.message, "link": n.link, "read": n.read, "created_at": iso(n.created_at)}
        for n in rows]}


@router.post("/notifications/{notification_id}/read")
def mark_read(notification_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    n = db.get(Notification, notification_id)
    if n is None or n.user_id != user.id:
        raise HTTPException(status_code=404, detail="Notification not found")
    n.read = True
    db.commit()
    return {"id": n.id, "read": True}


@router.post("/notifications/read-all")
def mark_all_read(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.query(Notification).filter(Notification.user_id == user.id, Notification.read.is_(False)) \
        .update({Notification.read: True}, synchronize_session=False)
    db.commit()
    return {"ok": True}


# ---------- complaints ----------
@router.post("/complaints", status_code=201)
def file_complaint(body: ComplaintIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    c = Complaint(user_id=user.id, subject=body.subject.strip(), body=body.body.strip())
    db.add(c)
    audit(db, user.id, "complaint.create", f"complaint:{user.id}", body.subject)
    db.commit()
    db.refresh(c)
    return {"id": c.id, "status": c.status}


@router.get("/complaints/mine")
def my_complaints(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.query(Complaint).filter(Complaint.user_id == user.id).order_by(Complaint.created_at.desc()).all()
    return [{"id": c.id, "subject": c.subject, "status": c.status, "admin_note": c.admin_note,
             "created_at": iso(c.created_at)} for c in rows]


# ---------- collector verification (requires an actual review by an admin) ----------
@router.post("/collector/verification-request")
def request_verification(user: User = Depends(require_roles("collector")), db: Session = Depends(get_db)):
    if user.collector.verification_status == "verified":
        return {"verification_status": "verified"}
    user.collector.verification_status = "pending"
    audit(db, user.id, "collector.verification_request", user.collector.collector_code)
    db.commit()
    return {"verification_status": "pending"}


# ---------- public, no personal data ----------
@router.get("/public/stats")
def public_stats(db: Session = Depends(get_db)):
    """Live counts from the database. Shows zeros until real records exist."""
    recycled = db.query(func.coalesce(func.sum(MaterialLot.recycled_quantity_kg), 0.0)) \
        .filter(MaterialLot.status == "recycled").scalar()
    return {
        "registered_collectors": db.query(User).filter(User.role == "collector").count(),
        "registered_households": db.query(User).filter(User.role == "household").count(),
        "completed_transactions": db.query(Transaction).count(),
        "kg_collected": round(float(db.query(func.coalesce(func.sum(Transaction.confirmed_quantity_kg), 0.0)).scalar()), 1),
        "kg_recycled_confirmed": round(float(recycled), 1),
        "open_requests": db.query(ScrapRequest).filter(ScrapRequest.status == "open").count(),
    }


@router.get("/public/collectors/{code}")
def public_collector(code: str, db: Session = Depends(get_db)):
    profile = db.query(CollectorProfile).filter(CollectorProfile.collector_code == code).first()
    if profile is None:
        raise HTTPException(status_code=404, detail="Collector ID not found")
    u = profile.user
    first_name = u.full_name.split()[0] if u.full_name else "Collector"
    return {
        "collector_code": profile.collector_code,
        "display_name": first_name,
        "service_city": u.city,
        "verification_status": profile.verification_status,
        "completed_pickups": profile.completed_pickups,
        "rating": average_rating(db, u.id),
    }


# ---------- prices (read) ----------
@router.get("/prices/current")
def current_prices(db: Session = Depends(get_db)):
    items = []
    for code in CATEGORY_LABELS:
        row = latest_reference(db, code)
        if row:
            items.append({"category": code, "label": category_label(code), "price_per_kg": row.price_per_kg,
                          "effective_from": iso(row.effective_from), "source": row.source,
                          "is_sample": row.source.upper().startswith("SAMPLE")})
    return items


@router.get("/prices/history/{category}")
def price_history(category: str, db: Session = Depends(get_db)):
    rows = (db.query(ReferencePrice).filter(ReferencePrice.category == category)
            .order_by(ReferencePrice.effective_from.desc(), ReferencePrice.id.desc()).all())
    return [{"price_per_kg": r.price_per_kg, "effective_from": iso(r.effective_from), "source": r.source} for r in rows]
