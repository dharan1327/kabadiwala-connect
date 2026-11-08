from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..auth import require_roles
from ..constants import ACTIVE_REQUEST_STATUSES
from ..database import get_db
from ..models import AuditLog, Complaint, MaterialLot, Organization, ReferencePrice, ScrapRequest, Transaction, User, utcnow
from ..schemas import AuthorizeIn, ComplaintResolveIn, PriceIn, SuspendIn, VerificationIn
from ..serializers import transaction_out, user_out
from ..utils import audit, iso, notify

router = APIRouter(prefix="/admin", tags=["admin"])
admin_only = require_roles("admin")


@router.get("/stats")
def platform_stats(user: User = Depends(admin_only), db: Session = Depends(get_db)):
    total_requests = db.query(ScrapRequest).count()
    completed_requests = db.query(ScrapRequest).filter(ScrapRequest.status == "completed").count()
    return {
        "users_by_role": {r: db.query(User).filter(User.role == r).count()
                          for r in ["household", "collector", "dealer", "recycler", "admin"]},
        "requests_total": total_requests,
        "requests_pending": db.query(ScrapRequest).filter(ScrapRequest.status.in_(ACTIVE_REQUEST_STATUSES)).count(),
        "requests_completed": completed_requests,
        "pickup_completion_rate_pct": round(completed_requests / total_requests * 100, 1) if total_requests else None,
        "transactions_completed": db.query(Transaction).count(),
        "kg_collected": round(float(db.query(func.coalesce(func.sum(Transaction.confirmed_quantity_kg), 0.0)).scalar()), 1),
        "earnings_recorded_inr": round(float(db.query(func.coalesce(func.sum(Transaction.total_amount), 0.0)).scalar()), 2),
        "kg_recycled_confirmed": round(float(db.query(func.coalesce(func.sum(MaterialLot.recycled_quantity_kg), 0.0))
                                             .filter(MaterialLot.status == "recycled").scalar()), 1),
        "flagged_transactions": db.query(Transaction).filter(Transaction.flagged.is_(True)).count(),
        "open_complaints": db.query(Complaint).filter(Complaint.status == "open").count(),
    }


@router.get("/users")
def list_users(role: Optional[str] = None, q: Optional[str] = None,
               user: User = Depends(admin_only), db: Session = Depends(get_db)):
    query = db.query(User)
    if role:
        query = query.filter(User.role == role)
    if q:
        term = f"%{q.strip()}%"
        query = query.filter((User.full_name.ilike(term)) | (User.email.ilike(term)))
    return [user_out(db, u) for u in query.order_by(User.created_at.desc()).limit(200).all()]


@router.post("/users/{user_id}/suspend")
def suspend_user(user_id: int, body: SuspendIn, admin: User = Depends(admin_only), db: Session = Depends(get_db)):
    target = db.get(User, user_id)
    if target is None:
        raise HTTPException(status_code=404, detail="User not found")
    if target.id == admin.id:
        raise HTTPException(status_code=400, detail="You cannot suspend your own account")
    target.suspended = body.suspended
    audit(db, admin.id, "user.suspend" if body.suspended else "user.reinstate", target.email)
    db.commit()
    return user_out(db, target)


@router.post("/collectors/{user_id}/verification")
def set_verification(user_id: int, body: VerificationIn, admin: User = Depends(admin_only),
                     db: Session = Depends(get_db)):
    target = db.get(User, user_id)
    if target is None or target.collector is None:
        raise HTTPException(status_code=404, detail="Collector not found")
    target.collector.verification_status = body.status
    notify(db, target.id, f"Your collector verification status is now: {body.status}", "/app/collector")
    audit(db, admin.id, "collector.verification", target.collector.collector_code, body.status)
    db.commit()
    return user_out(db, target)


@router.post("/organizations/{user_id}/authorize")
def authorize_org(user_id: int, body: AuthorizeIn, admin: User = Depends(admin_only), db: Session = Depends(get_db)):
    target = db.get(User, user_id)
    if target is None or target.organization is None:
        raise HTTPException(status_code=404, detail="Organisation not found")
    target.organization.authorized = body.authorized
    notify(db, target.id, "Your organisation authorisation was updated by the administrator")
    audit(db, admin.id, "organization.authorize", target.organization.name, str(body.authorized))
    db.commit()
    return user_out(db, target)


@router.get("/requests")
def list_requests(status: Optional[str] = None, admin: User = Depends(admin_only), db: Session = Depends(get_db)):
    q = db.query(ScrapRequest)
    if status:
        q = q.filter(ScrapRequest.status == status)
    rows = q.order_by(ScrapRequest.created_at.desc()).limit(200).all()
    return [{"id": r.id, "public_ref": r.public_ref, "category": r.category, "status": r.status,
             "est_quantity_kg": r.est_quantity_kg, "pickup_area": r.pickup_area,
             "category_source": r.category_source, "created_at": iso(r.created_at)} for r in rows]


@router.get("/transactions")
def list_transactions(admin: User = Depends(admin_only), db: Session = Depends(get_db)):
    rows = db.query(Transaction).order_by(Transaction.flagged.desc(), Transaction.created_at.desc()).limit(200).all()
    return [transaction_out(t) for t in rows]


@router.get("/complaints")
def list_complaints(admin: User = Depends(admin_only), db: Session = Depends(get_db)):
    rows = db.query(Complaint).order_by(Complaint.status.asc(), Complaint.created_at.desc()).all()
    return [{"id": c.id, "user_id": c.user_id, "subject": c.subject, "body": c.body, "status": c.status,
             "admin_note": c.admin_note, "created_at": iso(c.created_at)} for c in rows]


@router.post("/complaints/{complaint_id}/resolve")
def resolve_complaint(complaint_id: int, body: ComplaintResolveIn, admin: User = Depends(admin_only),
                      db: Session = Depends(get_db)):
    c = db.get(Complaint, complaint_id)
    if c is None:
        raise HTTPException(status_code=404, detail="Complaint not found")
    c.status, c.admin_note, c.resolved_at = "resolved", body.admin_note, utcnow()
    notify(db, c.user_id, f"Your complaint '{c.subject}' has been resolved")
    audit(db, admin.id, "complaint.resolve", f"complaint:{c.id}")
    db.commit()
    return {"id": c.id, "status": c.status}


@router.get("/audit")
def audit_log(admin: User = Depends(admin_only), db: Session = Depends(get_db)):
    rows = db.query(AuditLog).order_by(AuditLog.created_at.desc(), AuditLog.id.desc()).limit(200).all()
    return [{"id": a.id, "actor_id": a.actor_id, "action": a.action, "target": a.target,
             "detail": a.detail, "created_at": iso(a.created_at)} for a in rows]


@router.post("/prices", status_code=201)
def add_reference_price(body: PriceIn, admin: User = Depends(admin_only), db: Session = Depends(get_db)):
    """Adds a new reference price. Previous values remain in history."""
    from datetime import datetime, timezone
    effective = (datetime.fromisoformat(body.effective_from).replace(tzinfo=timezone.utc)
                 if body.effective_from else utcnow())
    row = ReferencePrice(category=body.category, price_per_kg=body.price_per_kg,
                         effective_from=effective, source=body.source.strip(), set_by_id=admin.id)
    db.add(row)
    audit(db, admin.id, "price.update", body.category, f"₹{body.price_per_kg}/kg source={body.source}")
    db.commit()
    return {"category": row.category, "price_per_kg": row.price_per_kg, "effective_from": iso(row.effective_from),
            "source": row.source}
