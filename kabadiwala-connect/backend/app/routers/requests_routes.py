import io
import os
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from .. import ai
from ..auth import get_current_user, require_roles
from ..config import settings
from ..constants import ACTIVE_REQUEST_STATUSES, REQUEST_STATUS_LABELS
from ..database import get_db
from ..models import CollectorProfile, PriceOffer, ScrapImage, ScrapRequest, Transaction, MaterialLot, User, utcnow
from ..schemas import AcceptIn, CompleteIn, OfferIn, RequestIn, ReviewIn, StatusIn
from ..serializers import distance_between, offer_out, request_out, transaction_out
from ..utils import (add_event, audit, category_label, current_reference_price, flag_price,
                     haversine_km, iso, latest_reference, new_ref, notify)
from ..models import Review

router = APIRouter(tags=["requests"])
ALLOWED_IMAGE_TYPES = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}
NEXT_STATUS = {"arriving": "scheduled", "collected": "arriving"}


# ---------- helpers ----------
def _own_request(db: Session, request_id: int, user: User) -> ScrapRequest:
    req = db.get(ScrapRequest, request_id)
    if req is None or req.household_id != user.id:
        raise HTTPException(status_code=404, detail="Request not found")
    return req


def _assigned_request(db: Session, request_id: int, user: User) -> ScrapRequest:
    req = db.get(ScrapRequest, request_id)
    if req is None:
        raise HTTPException(status_code=404, detail="Request not found")
    if req.assigned_collector_id != user.id:
        raise HTTPException(status_code=403, detail="Only the assigned collector can update this pickup")
    return req


def _active_offer(db: Session, request_id: int, collector_id: int) -> Optional[PriceOffer]:
    return (db.query(PriceOffer)
            .filter(PriceOffer.request_id == request_id, PriceOffer.collector_id == collector_id,
                    PriceOffer.status == "active")
            .first())


def _collectors_in_range(db: Session, lat: Optional[float], lng: Optional[float]) -> list[User]:
    users = (db.query(User).join(CollectorProfile, CollectorProfile.user_id == User.id)
             .filter(User.role == "collector", User.suspended.is_(False)).all())
    out = []
    for u in users:
        if lat is None or lng is None or u.lat is None:
            out.append(u)
            continue
        d = haversine_km(u.lat, u.lng, lat, lng)
        if d is not None and d <= u.collector.service_radius_km:
            out.append(u)
    return out


# ---------- photographs and AI ----------
@router.post("/scrap/images", status_code=201)
async def upload_scrap_image(file: UploadFile = File(...),
                             user: User = Depends(require_roles("household")),
                             db: Session = Depends(get_db)):
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=415, detail="Upload a JPEG, PNG or WebP photograph")
    data = await file.read()
    if len(data) > settings.max_upload_mb * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"Photograph must be under {settings.max_upload_mb} MB")
    try:
        from PIL import Image

        with Image.open(io.BytesIO(data)) as img:
            img.verify()
    except Exception as exc:
        raise HTTPException(status_code=415, detail="The file is not a valid image") from exc
    os.makedirs(settings.upload_dir, exist_ok=True)
    path = os.path.join(settings.upload_dir, f"{uuid.uuid4().hex}{ALLOWED_IMAGE_TYPES[file.content_type]}")
    with open(path, "wb") as fh:
        fh.write(data)
    image = ScrapImage(uploader_id=user.id, path=path, content_type=file.content_type, size_bytes=len(data))
    db.add(image)
    db.commit()
    db.refresh(image)
    return {"image_id": image.id}


@router.get("/scrap/images/{image_id}")
def get_scrap_image(image_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    image = db.get(ScrapImage, image_id)
    if image is None or (image.uploader_id != user.id and user.role != "admin"):
        raise HTTPException(status_code=404, detail="Photograph not found")
    return FileResponse(image.path, media_type=image.content_type)


@router.post("/scrap/images/{image_id}/classify")
def classify_scrap_image(image_id: int, user: User = Depends(require_roles("household")),
                         db: Session = Depends(get_db)):
    image = db.get(ScrapImage, image_id)
    if image is None or image.uploader_id != user.id:
        raise HTTPException(status_code=404, detail="Photograph not found")
    result = ai.classify(image.path)
    if result["status"] == "ok":
        image.ai_category = result["category"]
        image.ai_confidence = result["confidence"]
        db.commit()
    return result


# ---------- household requests ----------
@router.post("/requests", status_code=201)
def create_request(body: RequestIn, user: User = Depends(require_roles("household")),
                   db: Session = Depends(get_db)):
    image = None
    if body.image_id is not None:
        image = db.get(ScrapImage, body.image_id)
        if image is None or image.uploader_id != user.id:
            raise HTTPException(status_code=404, detail="Photograph not found")
    # AI fields come from the server-side classification record, never from the client.
    ai_cat = image.ai_category if image else None
    if not ai_cat:
        source = "manual"
    else:
        source = "ai_confirmed" if ai_cat == body.category else "ai_corrected"
    req = ScrapRequest(
        public_ref=new_ref("KC-REQ"), household_id=user.id, category=body.category,
        est_quantity_kg=body.est_quantity_kg, pickup_address=body.pickup_address,
        pickup_area=f"{user.city} · PIN {user.pin_code}",
        lat=body.pickup_lat if body.pickup_lat is not None else user.lat,
        lng=body.pickup_lng if body.pickup_lng is not None else user.lng,
        preferred_date=body.preferred_date, preferred_time=body.preferred_time,
        instructions=body.instructions, image_id=image.id if image else None,
        ai_category=ai_cat, ai_confidence=image.ai_confidence if image else None,
        category_source=source, status="open",
    )
    db.add(req)
    db.flush()
    label = category_label(req.category)
    add_event(db, "request_submitted", user.id, f"{label} · {req.est_quantity_kg} kg", request_id=req.id)
    for collector in _collectors_in_range(db, req.lat, req.lng):
        notify(db, collector.id, f"New {label} pickup request near {req.pickup_area}", "/app/collector")
    audit(db, user.id, "request.create", req.public_ref)
    db.commit()
    db.refresh(req)
    return request_out(db, req, user)


@router.get("/requests/mine")
def my_requests(user: User = Depends(require_roles("household")), db: Session = Depends(get_db)):
    rows = db.query(ScrapRequest).filter(ScrapRequest.household_id == user.id) \
        .order_by(ScrapRequest.created_at.desc()).all()
    return [request_out(db, r, user) for r in rows]


@router.get("/requests/{request_id}/offers")
def list_offers(request_id: int, user: User = Depends(require_roles("household")), db: Session = Depends(get_db)):
    req = _own_request(db, request_id, user)
    ref_row = latest_reference(db, req.category)
    ref = ref_row.price_per_kg if ref_row else None
    offers = (db.query(PriceOffer)
              .filter(PriceOffer.request_id == req.id, PriceOffer.status.in_(["active", "accepted"]))
              .order_by(PriceOffer.price_per_kg.desc()).all())
    items = []
    for o in offers:
        item = offer_out(db, o, household_view=True)
        item["gap_vs_reference_pct"] = round((o.price_per_kg - ref) / ref * 100, 1) if ref else None
        item["distance_km"] = distance_between(db.get(User, o.collector_id), req)
        items.append(item)
    return {"reference_price_per_kg": ref,
            "reference_source": ref_row.source if ref_row else None,
            "offers": items}


@router.post("/requests/{request_id}/cancel")
def cancel_request(request_id: int, user: User = Depends(require_roles("household")),
                   db: Session = Depends(get_db)):
    req = _own_request(db, request_id, user)
    if req.status != "open":
        raise HTTPException(status_code=409, detail="Only open requests can be cancelled")
    req.status = "cancelled"
    for o in db.query(PriceOffer).filter(PriceOffer.request_id == req.id, PriceOffer.status == "active").all():
        o.status = "withdrawn"
        notify(db, o.collector_id, f"Request {req.public_ref} was cancelled by the household")
    add_event(db, "request_cancelled", user.id, "", request_id=req.id)
    db.commit()
    return request_out(db, req, user)


@router.post("/requests/{request_id}/review", status_code=201)
def review_collector(request_id: int, body: ReviewIn, user: User = Depends(require_roles("household")),
                     db: Session = Depends(get_db)):
    req = _own_request(db, request_id, user)
    if req.status != "completed" or req.assigned_collector_id is None:
        raise HTTPException(status_code=409, detail="You can rate a collector after the transaction is completed")
    if db.query(Review).filter(Review.request_id == req.id).first():
        raise HTTPException(status_code=409, detail="You have already rated this pickup")
    db.add(Review(request_id=req.id, household_id=user.id, collector_id=req.assigned_collector_id,
                  rating=body.rating, comment=body.comment))
    notify(db, req.assigned_collector_id, f"You received a {body.rating}-star rating for {req.public_ref}")
    db.commit()
    return {"rating": body.rating}


# ---------- collector: discovery and offers ----------
@router.get("/requests/nearby")
def nearby_requests(user: User = Depends(require_roles("collector")), db: Session = Depends(get_db)):
    radius = user.collector.service_radius_km
    rows = (db.query(ScrapRequest).filter(ScrapRequest.status == "open")
            .order_by(ScrapRequest.created_at.desc()).limit(200).all())
    out = []
    for r in rows:
        dist = haversine_km(user.lat, user.lng, r.lat, r.lng)
        if dist is not None and dist > radius:
            continue
        item = request_out(db, r, user)  # no address: collector is not assigned yet
        item["distance_km"] = round(dist, 1) if dist is not None else None
        mine = _active_offer(db, r.id, user.id)
        item["my_offer"] = offer_out(db, mine, household_view=False) if mine else None
        out.append(item)
    return out


@router.get("/requests/{request_id}")
def get_request(request_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    req = db.get(ScrapRequest, request_id)
    if req is None:
        raise HTTPException(status_code=404, detail="Request not found")
    allowed = (user.role == "admin" or user.id == req.household_id
               or user.id == req.assigned_collector_id
               or (user.role == "collector" and req.status == "open"))
    if not allowed:
        raise HTTPException(status_code=403, detail="You do not have access to this request")
    return request_out(db, req, user)


@router.get("/requests/{request_id}/timeline")
def request_timeline(request_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    from ..constants import STAGE_LABELS
    from ..models import TrackingEvent
    req = db.get(ScrapRequest, request_id)
    if req is None:
        raise HTTPException(status_code=404, detail="Request not found")
    allowed = user.role == "admin" or user.id in (req.household_id, req.assigned_collector_id)
    if not allowed:
        raise HTTPException(status_code=403, detail="You do not have access to this timeline")
    events = (db.query(TrackingEvent).filter(TrackingEvent.request_id == req.id)
              .order_by(TrackingEvent.created_at, TrackingEvent.id).all())
    return [{"stage": e.stage, "label": STAGE_LABELS.get(e.stage, e.stage), "note": e.note,
             "actor_role": (db.get(User, e.actor_id).role if e.actor_id else None),
             "at": iso(e.created_at)} for e in events]


@router.post("/requests/{request_id}/offers", status_code=201)
def submit_offer(request_id: int, body: OfferIn, user: User = Depends(require_roles("collector")),
                 db: Session = Depends(get_db)):
    req = db.get(ScrapRequest, request_id)
    if req is None:
        raise HTTPException(status_code=404, detail="Request not found")
    if req.status != "open":
        raise HTTPException(status_code=409, detail="This request is no longer accepting offers")
    if _active_offer(db, req.id, user.id):
        raise HTTPException(status_code=409, detail="You already have an active offer. Modify it instead.")
    flagged, reason = flag_price(body.price_per_kg, current_reference_price(db, req.category))
    offer = PriceOffer(request_id=req.id, collector_id=user.id, price_per_kg=body.price_per_kg,
                       message=body.message, status="active", flagged=flagged, flag_reason=reason)
    db.add(offer)
    db.flush()
    add_event(db, "offer_submitted", user.id, f"₹{body.price_per_kg}/kg", request_id=req.id)
    notify(db, req.household_id, f"New price offer for {req.public_ref}: ₹{body.price_per_kg}/kg", "/app/household")
    db.commit()
    db.refresh(offer)
    return offer_out(db, offer, household_view=False)


@router.patch("/offers/{offer_id}")
def modify_offer(offer_id: int, body: OfferIn, user: User = Depends(require_roles("collector")),
                 db: Session = Depends(get_db)):
    offer = db.get(PriceOffer, offer_id)
    if offer is None or offer.collector_id != user.id:
        raise HTTPException(status_code=404, detail="Offer not found")
    req = db.get(ScrapRequest, offer.request_id)
    if offer.status != "active" or req.status != "open":
        raise HTTPException(status_code=409, detail="Only active offers on open requests can be modified")
    flagged, reason = flag_price(body.price_per_kg, current_reference_price(db, req.category))
    offer.price_per_kg, offer.message = body.price_per_kg, body.message
    offer.flagged, offer.flag_reason = flagged, reason
    offer.updated_at = utcnow()
    notify(db, req.household_id, f"Offer for {req.public_ref} was updated to ₹{body.price_per_kg}/kg")
    db.commit()
    return offer_out(db, offer, household_view=False)


@router.post("/offers/{offer_id}/withdraw")
def withdraw_offer(offer_id: int, user: User = Depends(require_roles("collector")), db: Session = Depends(get_db)):
    offer = db.get(PriceOffer, offer_id)
    if offer is None or offer.collector_id != user.id:
        raise HTTPException(status_code=404, detail="Offer not found")
    req = db.get(ScrapRequest, offer.request_id)
    if offer.status != "active" or req.status != "open":
        raise HTTPException(status_code=409, detail="This offer can no longer be withdrawn")
    offer.status = "withdrawn"
    notify(db, req.household_id, f"A collector withdrew an offer on {req.public_ref}")
    db.commit()
    return offer_out(db, offer, household_view=False)


@router.post("/offers/{offer_id}/accept")
def accept_offer(offer_id: int, body: AcceptIn, user: User = Depends(require_roles("household")),
                 db: Session = Depends(get_db)):
    offer = db.get(PriceOffer, offer_id)
    if offer is None:
        raise HTTPException(status_code=404, detail="Offer not found")
    req = _own_request(db, offer.request_id, user)
    if offer.status != "active" or req.status != "open":
        raise HTTPException(status_code=409, detail="This offer can no longer be accepted")
    offer.status = "accepted"
    for other in db.query(PriceOffer).filter(PriceOffer.request_id == req.id, PriceOffer.id != offer.id,
                                             PriceOffer.status == "active").all():
        other.status = "rejected"
        notify(db, other.collector_id, f"Your offer for {req.public_ref} was not selected")
    req.status = "scheduled"
    req.assigned_collector_id = offer.collector_id
    req.accepted_offer_id = offer.id
    req.scheduled_date = body.pickup_date or req.preferred_date
    req.scheduled_time = body.pickup_time or req.preferred_time
    add_event(db, "offer_accepted", user.id, f"₹{offer.price_per_kg}/kg", request_id=req.id)
    add_event(db, "pickup_scheduled", user.id, f"{req.scheduled_date} {req.scheduled_time}", request_id=req.id)
    notify(db, offer.collector_id,
           f"Your offer for {req.public_ref} was accepted. Pickup on {req.scheduled_date} at {req.scheduled_time}",
           "/app/collector")
    audit(db, user.id, "offer.accept", f"offer:{offer.id}", req.public_ref)
    db.commit()
    return request_out(db, req, user)


@router.post("/offers/{offer_id}/reject")
def reject_offer(offer_id: int, user: User = Depends(require_roles("household")), db: Session = Depends(get_db)):
    offer = db.get(PriceOffer, offer_id)
    if offer is None:
        raise HTTPException(status_code=404, detail="Offer not found")
    req = _own_request(db, offer.request_id, user)
    if offer.status != "active":
        raise HTTPException(status_code=409, detail="Only active offers can be rejected")
    offer.status = "rejected"
    notify(db, offer.collector_id, f"Your offer for {req.public_ref} was declined")
    db.commit()
    return {"id": offer.id, "status": offer.status}


# ---------- collector: pickups ----------
@router.get("/pickups/assigned")
def assigned_pickups(user: User = Depends(require_roles("collector")), db: Session = Depends(get_db)):
    rows = (db.query(ScrapRequest).filter(ScrapRequest.assigned_collector_id == user.id)
            .order_by(ScrapRequest.updated_at.desc()).all())
    return [request_out(db, r, user) for r in rows]


@router.get("/pickups/route")
def pickup_route(user: User = Depends(require_roles("collector")), db: Session = Depends(get_db)):
    stops = [r for r in db.query(ScrapRequest).filter(ScrapRequest.assigned_collector_id == user.id,
                                                      ScrapRequest.status.in_(["scheduled", "arriving"])).all()
             if r.lat is not None and r.lng is not None]
    method = "Nearest-neighbour route by straight-line distance (basic heuristic, not AI optimisation)"
    if user.lat is None or user.lng is None:
        return {"method": method, "total_km": None, "stops": [],
                "message": "Set your base location in your profile to compute a route."}
    here = (user.lat, user.lng)
    remaining, ordered, total = list(stops), [], 0.0
    while remaining:
        nxt = min(remaining, key=lambda r: haversine_km(here[0], here[1], r.lat, r.lng))
        leg = haversine_km(here[0], here[1], nxt.lat, nxt.lng)
        total += leg
        ordered.append({"request_id": nxt.id, "public_ref": nxt.public_ref, "address": nxt.pickup_address,
                        "lat": nxt.lat, "lng": nxt.lng,
                        "category_label": category_label(nxt.category), "leg_km": round(leg, 2),
                        "scheduled_time": nxt.scheduled_time})
        here = (nxt.lat, nxt.lng)
        remaining.remove(nxt)
    return {"method": method, "total_km": round(total, 2), "stops": ordered, "message": None}


@router.post("/requests/{request_id}/status")
def update_pickup_status(request_id: int, body: StatusIn, user: User = Depends(require_roles("collector")),
                         db: Session = Depends(get_db)):
    req = _assigned_request(db, request_id, user)
    if req.status != NEXT_STATUS[body.status]:
        raise HTTPException(status_code=409, detail=f"Cannot mark '{body.status}' from status '{req.status}'")
    req.status = body.status
    stage = "collector_arriving" if body.status == "arriving" else "material_collected"
    add_event(db, stage, user.id, "", request_id=req.id)
    notify(db, req.household_id, f"{req.public_ref}: {REQUEST_STATUS_LABELS[body.status]}", "/app/household")
    db.commit()
    return request_out(db, req, user)


@router.post("/requests/{request_id}/complete", status_code=201)
def complete_pickup(request_id: int, body: CompleteIn, user: User = Depends(require_roles("collector")),
                    db: Session = Depends(get_db)):
    req = _assigned_request(db, request_id, user)
    if req.status != "collected":
        raise HTTPException(status_code=409, detail="Mark the material as collected before completing the transaction")
    total = round(body.confirmed_quantity_kg * body.price_per_kg, 2)
    flagged, reason = flag_price(body.price_per_kg, current_reference_price(db, req.category))
    txn = Transaction(
        public_ref=new_ref("KC-TXN"), handover_ref=new_ref("KC-HO"), request_id=req.id,
        household_id=req.household_id, collector_id=user.id, category=req.category,
        confirmed_quantity_kg=body.confirmed_quantity_kg, price_per_kg=body.price_per_kg,
        total_amount=total, flagged=flagged, flag_reason=reason,
    )
    db.add(txn)
    db.flush()
    db.add(MaterialLot(transaction_id=txn.id, category=req.category,
                       quantity_kg=body.confirmed_quantity_kg, status="available"))
    req.status = "completed"
    user.collector.completed_pickups += 1
    add_event(db, "transaction_completed", user.id, f"{txn.public_ref} · ₹{total}", request_id=req.id)
    notify(db, req.household_id,
           f"Pickup complete: ₹{total}. Handover reference {txn.handover_ref}. You can now rate the collector.",
           "/app/household")
    audit(db, user.id, "transaction.complete", txn.public_ref, f"{body.confirmed_quantity_kg} kg @ ₹{body.price_per_kg}")
    db.commit()
    db.refresh(txn)
    return transaction_out(txn)
