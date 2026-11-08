from typing import Optional

from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

from .config import settings
from .database import get_db
from .models import User

_firebase_initialised = False


def bearer_token(authorization: Optional[str]) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Sign in required")
    return authorization.split(" ", 1)[1].strip()


def verify_firebase_token(token: str) -> dict:
    """Verify a Firebase ID token. Requires firebase-admin and FIREBASE_PROJECT_ID."""
    global _firebase_initialised
    try:
        import firebase_admin
        from firebase_admin import auth as fb_auth
        from firebase_admin import credentials
    except ImportError as exc:  # pragma: no cover
        raise HTTPException(status_code=500, detail="Server auth is misconfigured") from exc
    if not _firebase_initialised:
        if not firebase_admin._apps:
            cred = (credentials.Certificate(settings.firebase_credentials_path)
                    if settings.firebase_credentials_path else credentials.ApplicationDefault())
            firebase_admin.initialize_app(cred, {"projectId": settings.firebase_project_id})
        _firebase_initialised = True
    try:
        return fb_auth.verify_id_token(token, check_revoked=True)
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Your session has expired. Please sign in again.") from exc


def get_current_user(
    authorization: Optional[str] = Header(default=None),
    x_dev_email: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
) -> User:
    if settings.auth_mode == "firebase":
        claims = verify_firebase_token(bearer_token(authorization))
        if not claims.get("email_verified"):
            raise HTTPException(status_code=403, detail="Verify your email address to continue")
        user = db.query(User).filter(User.uid == claims["uid"]).first()
    elif x_dev_email:  # DEV ONLY: demo header auth. Disabled when AUTH_MODE=firebase.
        user = db.query(User).filter(User.email == x_dev_email.strip().lower()).first()
    else:
        raise HTTPException(status_code=401, detail="Sign in required")
    if user is None:
        raise HTTPException(status_code=403, detail="No Kabadiwala Connect profile for this account. Please register.")
    if user.suspended:
        raise HTTPException(status_code=403, detail="This account is suspended. Please contact support.")
    return user


def require_roles(*roles: str):
    def checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(status_code=403, detail="This action is not available for your role")
        return user

    return checker
