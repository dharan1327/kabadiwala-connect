from typing import Literal, Optional

from pydantic import BaseModel, Field

CategoryCode = Literal[
    "paper", "cardboard", "plastic", "mixed_plastics", "iron", "aluminium", "copper", "glass",
    "circuit_boards", "cables", "batteries", "screens", "motors", "other",
]
DATE_RE = r"^\d{4}-\d{2}-\d{2}$"
TIME_RE = r"^\d{2}:\d{2}$"


class RegisterIn(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$", max_length=255)
    phone: str = Field(pattern=r"^\+?\d{10,15}$")
    address: str = Field(min_length=5, max_length=300)
    city: str = Field(min_length=2, max_length=80)
    pin_code: str = Field(pattern=r"^\d{6}$")
    role: Literal["household", "collector", "dealer", "recycler"]
    organization_name: Optional[str] = Field(default=None, max_length=150)
    lat: Optional[float] = Field(default=None, ge=-90, le=90)
    lng: Optional[float] = Field(default=None, ge=-180, le=180)


class RequestIn(BaseModel):
    category: CategoryCode
    est_quantity_kg: float = Field(gt=0, le=5000)
    pickup_address: str = Field(min_length=5, max_length=300)
    pickup_lat: Optional[float] = Field(default=None, ge=-90, le=90)
    pickup_lng: Optional[float] = Field(default=None, ge=-180, le=180)
    preferred_date: str = Field(pattern=DATE_RE)
    preferred_time: str = Field(pattern=TIME_RE)
    instructions: Optional[str] = Field(default=None, max_length=500)
    image_id: Optional[int] = None


class OfferIn(BaseModel):
    price_per_kg: float = Field(gt=0, le=100000)
    message: Optional[str] = Field(default=None, max_length=300)


class AcceptIn(BaseModel):
    pickup_date: Optional[str] = Field(default=None, pattern=DATE_RE)
    pickup_time: Optional[str] = Field(default=None, pattern=TIME_RE)


class StatusIn(BaseModel):
    status: Literal["arriving", "collected"]


class CompleteIn(BaseModel):
    confirmed_quantity_kg: float = Field(gt=0, le=5000)
    price_per_kg: float = Field(gt=0, le=100000)


class ReviewIn(BaseModel):
    rating: int = Field(ge=1, le=5)
    comment: Optional[str] = Field(default=None, max_length=300)


class PriceIn(BaseModel):
    category: CategoryCode
    price_per_kg: float = Field(gt=0, le=100000)
    effective_from: Optional[str] = Field(default=None, pattern=DATE_RE)
    source: str = Field(min_length=3, max_length=200)


class ComplaintIn(BaseModel):
    subject: str = Field(min_length=2, max_length=120)
    body: str = Field(min_length=5, max_length=2000)


class ComplaintResolveIn(BaseModel):
    admin_note: str = Field(min_length=2, max_length=500)


class PurchaseIn(BaseModel):
    price_per_kg: float = Field(gt=0, le=100000)


class DispatchIn(BaseModel):
    recycler_id: int


class ReceiveIn(BaseModel):
    inspection: Literal["pass", "fail"]
    received_quantity_kg: float = Field(gt=0, le=5000)


class ProcessIn(BaseModel):
    status: Literal["processing", "recycled"]
    recycled_quantity_kg: Optional[float] = Field(default=None, gt=0, le=5000)


class SuspendIn(BaseModel):
    suspended: bool


class AuthorizeIn(BaseModel):
    authorized: bool


class VerificationIn(BaseModel):
    status: Literal["unverified", "pending", "verified"]
