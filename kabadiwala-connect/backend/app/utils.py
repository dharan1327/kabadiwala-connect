import math
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

from .constants import CATEGORY_LABELS
from .models import AuditLog, Notification, ReferencePrice, TrackingEvent

# Offers outside these multiples of the reference price are flagged for admin review (not blocked).
PRICE_HIGH_RATIO = 2.5
PRICE_LOW_RATIO = 0.3


def haversine_km(lat1, lng1, lat2, lng2) -> Optional[float]:
    if None in (lat1, lng1, lat2, lng2):
        return None
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = p2 - p1
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def new_ref(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8].upper()}"


def category_label(code: str) -> str:
    return CATEGORY_LABELS.get(code, code)


def iso(value: Optional[datetime]) -> Optional[str]:
    return value.isoformat() if value else None


def latest_reference(db: Session, category: str) -> Optional[ReferencePrice]:
    return (
        db.query(ReferencePrice)
        .filter(ReferencePrice.category == category)
        .order_by(ReferencePrice.effective_from.desc(), ReferencePrice.id.desc())
        .first()
    )


def current_reference_price(db: Session, category: str) -> Optional[float]:
    row = latest_reference(db, category)
    return row.price_per_kg if row else None


def flag_price(price: float, reference: Optional[float]) -> tuple[bool, Optional[str]]:
    if not reference:
        return False, None
    ratio = price / reference
    if ratio > PRICE_HIGH_RATIO:
        return True, f"Price is {ratio:.1f}x the reference price"
    if ratio < PRICE_LOW_RATIO:
        return True, f"Price is only {ratio:.0%} of the reference price"
    return False, None


def add_event(db: Session, stage: str, actor_id: Optional[int], note: str = "",
              request_id: Optional[int] = None, lot_id: Optional[int] = None) -> None:
    db.add(TrackingEvent(stage=stage, actor_id=actor_id, note=note, request_id=request_id, lot_id=lot_id))


def notify(db: Session, user_id: int, message: str, link: Optional[str] = None) -> None:
    db.add(Notification(user_id=user_id, message=message, link=link))


def audit(db: Session, actor_id: Optional[int], action: str, target: str, detail: str = "") -> None:
    db.add(AuditLog(actor_id=actor_id, action=action, target=target, detail=detail))
