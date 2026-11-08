from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from .constants import REQUEST_STATUS_LABELS
from .models import MaterialLot, Organization, PriceOffer, Review, ScrapRequest, Transaction, User
from .utils import category_label, haversine_km, iso


def user_out(db: Session, u: User) -> dict:
    data = {
        "id": u.id, "email": u.email, "full_name": u.full_name, "role": u.role,
        "city": u.city, "pin_code": u.pin_code, "suspended": u.suspended,
        "lat": u.lat, "lng": u.lng, "created_at": iso(u.created_at),
    }
    if u.collector is not None:
        data.update(
            collector_code=u.collector.collector_code,
            verification_status=u.collector.verification_status,
            service_radius_km=u.collector.service_radius_km,
            completed_pickups=u.collector.completed_pickups,
        )
    if u.organization is not None:
        data.update(organization_name=u.organization.name, organization_kind=u.organization.kind,
                    authorized=u.organization.authorized)
    return data


def average_rating(db: Session, collector_id: int) -> Optional[float]:
    avg = db.query(func.avg(Review.rating)).filter(Review.collector_id == collector_id).scalar()
    return round(float(avg), 1) if avg is not None else None


def request_out(db: Session, req: ScrapRequest, viewer: User) -> dict:
    is_owner = viewer.id == req.household_id
    is_assigned = viewer.id == req.assigned_collector_id
    active_offers = db.query(PriceOffer).filter(
        PriceOffer.request_id == req.id, PriceOffer.status == "active").count()
    data = {
        "id": req.id, "public_ref": req.public_ref,
        "category": req.category, "category_label": category_label(req.category),
        "est_quantity_kg": req.est_quantity_kg, "pickup_area": req.pickup_area,
        "preferred_date": req.preferred_date, "preferred_time": req.preferred_time,
        "scheduled_date": req.scheduled_date, "scheduled_time": req.scheduled_time,
        "status": req.status, "status_label": REQUEST_STATUS_LABELS.get(req.status, req.status),
        "ai_category": req.ai_category, "ai_confidence": req.ai_confidence,
        "category_source": req.category_source, "active_offers": active_offers,
        "is_owner": is_owner, "created_at": iso(req.created_at),
    }
    if is_owner or is_assigned:  # private details: owner and assigned collector only
        data.update(pickup_address=req.pickup_address, lat=req.lat, lng=req.lng,
                    instructions=req.instructions)
    return data


def offer_out(db: Session, offer: PriceOffer, household_view: bool) -> dict:
    data = {
        "id": offer.id, "request_id": offer.request_id, "collector_id": offer.collector_id,
        "price_per_kg": offer.price_per_kg, "message": offer.message, "status": offer.status,
        "flagged": offer.flagged, "flag_reason": offer.flag_reason,
        "created_at": iso(offer.created_at), "updated_at": iso(offer.updated_at),
    }
    if household_view:
        collector = db.get(User, offer.collector_id)
        profile = collector.collector if collector else None
        data.update(
            collector_name=collector.full_name if collector else None,
            collector_code=profile.collector_code if profile else None,
            completed_pickups=profile.completed_pickups if profile else 0,
            collector_rating=average_rating(db, offer.collector_id),
        )
    return data


def transaction_out(txn: Transaction) -> dict:
    return {
        "id": txn.id, "public_ref": txn.public_ref, "handover_ref": txn.handover_ref,
        "request_id": txn.request_id, "category": txn.category,
        "category_label": category_label(txn.category),
        "confirmed_quantity_kg": txn.confirmed_quantity_kg, "price_per_kg": txn.price_per_kg,
        "total_amount": txn.total_amount, "flagged": txn.flagged, "flag_reason": txn.flag_reason,
        "household_id": txn.household_id, "collector_id": txn.collector_id,
        "created_at": iso(txn.created_at),
    }


def lot_out(db: Session, lot: MaterialLot) -> dict:
    txn = db.get(Transaction, lot.transaction_id)
    collector = db.get(User, txn.collector_id) if txn else None
    profile = collector.collector if collector else None
    return {
        "id": lot.id, "category": lot.category, "category_label": category_label(lot.category),
        "quantity_kg": lot.quantity_kg, "status": lot.status,
        "dealer_id": lot.dealer_id, "recycler_id": lot.recycler_id,
        "purchase_price_per_kg": lot.purchase_price_per_kg,
        "received_quantity_kg": lot.received_quantity_kg, "inspection": lot.inspection,
        "recycled_quantity_kg": lot.recycled_quantity_kg,
        "transaction_id": txn.id if txn else None,
        "transaction_ref": txn.public_ref if txn else None,
        "collector_code": profile.collector_code if profile else None,
        "collector_city": collector.city if collector else None,
        "updated_at": iso(lot.updated_at),
    }


def distance_between(a: User, req: ScrapRequest) -> Optional[float]:
    d = haversine_km(a.lat, a.lng, req.lat, req.lng)
    return round(d, 1) if d is not None else None
