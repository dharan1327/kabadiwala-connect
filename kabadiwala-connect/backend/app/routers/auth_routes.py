from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..auth import bearer_token, get_current_user, verify_firebase_token
from ..config import settings
from ..database import get_db
from ..models import CollectorProfile, Organization, User
from ..schemas import RegisterIn
from ..serializers import user_out
from ..utils import audit

router = APIRouter(tags=["auth"])
CITY_CODES = {}


def _next_collector_code(db: Session, city: str) -> str:
    prefix = "".join(ch for ch in city.upper() if ch.isalpha())[:3] or "KC"
    seq = db.query(CollectorProfile).count() + 1
    code = f"KC-{prefix}-{seq:06d}"
    while db.query(CollectorProfile).filter(CollectorProfile.collector_code == code).first():
        seq += 1
        code = f"KC-{prefix}-{seq:06d}"
    return code


@router.post("/auth/register", status_code=201)
def register(body: RegisterIn, authorization: Optional[str] = Header(default=None),
             db: Session = Depends(get_db)):
    if settings.auth_mode == "firebase":
        # The Firebase account is created client-side; the token proves its owner.
        claims = verify_firebase_token(bearer_token(authorization))
        uid, email = claims["uid"], (claims.get("email") or body.email).lower()
    else:  # DEV ONLY
        uid, email = f"dev-{body.email.lower()}", body.email.lower()
    if db.query(User).filter(or_(User.uid == uid, User.email == email)).first():
        raise HTTPException(status_code=409, detail="An account already exists for this email")
    user = User(uid=uid, email=email, full_name=body.full_name.strip(), phone=body.phone,
                role=body.role, address=body.address.strip(), city=body.city.strip(),
                pin_code=body.pin_code, lat=body.lat, lng=body.lng)
    db.add(user)
    db.flush()
    if body.role == "collector":
        db.add(CollectorProfile(user_id=user.id, collector_code=_next_collector_code(db, user.city),
                                service_radius_km=settings.match_radius_km, verification_status="unverified"))
    if body.role in ("dealer", "recycler"):
        db.add(Organization(user_id=user.id, name=(body.organization_name or body.full_name).strip(),
                            kind=body.role, authorized=False))
    audit(db, user.id, "user.register", user.email, body.role)
    db.commit()
    db.refresh(user)
    return user_out(db, user)


@router.get("/auth/me")
def me(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return user_out(db, user)
