from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    uid: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(120))
    phone: Mapped[str] = mapped_column(String(16))
    role: Mapped[str] = mapped_column(String(20), index=True)  # household|collector|dealer|recycler|admin
    address: Mapped[str] = mapped_column(String(300))  # private: never returned to other users
    city: Mapped[str] = mapped_column(String(80))
    pin_code: Mapped[str] = mapped_column(String(6))
    lat: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    lng: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    suspended: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    collector: Mapped[Optional["CollectorProfile"]] = relationship(back_populates="user", uselist=False)
    organization: Mapped[Optional["Organization"]] = relationship(back_populates="user", uselist=False)


class CollectorProfile(Base):
    __tablename__ = "collector_profiles"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True)
    collector_code: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    service_radius_km: Mapped[float] = mapped_column(Float, default=10.0)
    verification_status: Mapped[str] = mapped_column(String(16), default="unverified")  # unverified|pending|verified
    completed_pickups: Mapped[int] = mapped_column(Integer, default=0)
    user: Mapped[User] = relationship(back_populates="collector")


class Organization(Base):
    __tablename__ = "organizations"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True)
    name: Mapped[str] = mapped_column(String(150))
    kind: Mapped[str] = mapped_column(String(12))  # dealer|recycler
    authorized: Mapped[bool] = mapped_column(Boolean, default=False)  # set by admin only
    user: Mapped[User] = relationship(back_populates="organization")


class ScrapImage(Base):
    __tablename__ = "scrap_images"
    id: Mapped[int] = mapped_column(primary_key=True)
    uploader_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    path: Mapped[str] = mapped_column(String(300))
    content_type: Mapped[str] = mapped_column(String(40))
    size_bytes: Mapped[int] = mapped_column(Integer)
    ai_category: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    ai_confidence: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class ReferencePrice(Base):
    __tablename__ = "reference_prices"
    id: Mapped[int] = mapped_column(primary_key=True)
    category: Mapped[str] = mapped_column(String(40), index=True)
    price_per_kg: Mapped[float] = mapped_column(Float)
    effective_from: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    source: Mapped[str] = mapped_column(String(200))  # e.g. "SAMPLE – demonstration only" or a real source
    set_by_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class ScrapRequest(Base):
    __tablename__ = "scrap_requests"
    id: Mapped[int] = mapped_column(primary_key=True)
    public_ref: Mapped[str] = mapped_column(String(20), unique=True)
    household_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    category: Mapped[str] = mapped_column(String(40))
    est_quantity_kg: Mapped[float] = mapped_column(Float)
    pickup_address: Mapped[str] = mapped_column(Text)  # private: owner + assigned collector only
    pickup_area: Mapped[str] = mapped_column(String(120))  # shown to collectors before acceptance
    lat: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    lng: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    preferred_date: Mapped[str] = mapped_column(String(10))
    preferred_time: Mapped[str] = mapped_column(String(5))
    scheduled_date: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    scheduled_time: Mapped[Optional[str]] = mapped_column(String(5), nullable=True)
    instructions: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    image_id: Mapped[Optional[int]] = mapped_column(ForeignKey("scrap_images.id"), nullable=True)
    ai_category: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    ai_confidence: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    category_source: Mapped[str] = mapped_column(String(20), default="manual")  # manual|ai_confirmed|ai_corrected
    status: Mapped[str] = mapped_column(String(20), default="open", index=True)
    assigned_collector_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    accepted_offer_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class PriceOffer(Base):
    __tablename__ = "price_offers"
    id: Mapped[int] = mapped_column(primary_key=True)
    request_id: Mapped[int] = mapped_column(ForeignKey("scrap_requests.id"), index=True)
    collector_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    price_per_kg: Mapped[float] = mapped_column(Float)
    message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(16), default="active")  # active|accepted|rejected|withdrawn
    flagged: Mapped[bool] = mapped_column(Boolean, default=False)
    flag_reason: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class Transaction(Base):
    __tablename__ = "transactions"
    id: Mapped[int] = mapped_column(primary_key=True)
    public_ref: Mapped[str] = mapped_column(String(20), unique=True)
    handover_ref: Mapped[str] = mapped_column(String(20), unique=True)
    request_id: Mapped[int] = mapped_column(ForeignKey("scrap_requests.id"), unique=True)
    household_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    collector_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    category: Mapped[str] = mapped_column(String(40))
    confirmed_quantity_kg: Mapped[float] = mapped_column(Float)
    price_per_kg: Mapped[float] = mapped_column(Float)
    total_amount: Mapped[float] = mapped_column(Float)
    flagged: Mapped[bool] = mapped_column(Boolean, default=False)
    flag_reason: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class MaterialLot(Base):
    __tablename__ = "material_lots"
    id: Mapped[int] = mapped_column(primary_key=True)
    transaction_id: Mapped[int] = mapped_column(ForeignKey("transactions.id"), unique=True)
    category: Mapped[str] = mapped_column(String(40), index=True)
    quantity_kg: Mapped[float] = mapped_column(Float)
    status: Mapped[str] = mapped_column(String(20), default="available", index=True)
    dealer_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    recycler_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    purchase_price_per_kg: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    received_quantity_kg: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    inspection: Mapped[Optional[str]] = mapped_column(String(8), nullable=True)  # pass|fail
    recycled_quantity_kg: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class MaterialTransfer(Base):
    __tablename__ = "material_transfers"
    id: Mapped[int] = mapped_column(primary_key=True)
    lot_id: Mapped[int] = mapped_column(ForeignKey("material_lots.id"), index=True)
    from_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    to_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    kind: Mapped[str] = mapped_column(String(30))  # dealer_purchase|dispatch_to_recycler
    quantity_kg: Mapped[float] = mapped_column(Float)
    price_per_kg: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class TrackingEvent(Base):
    __tablename__ = "tracking_events"
    id: Mapped[int] = mapped_column(primary_key=True)
    request_id: Mapped[Optional[int]] = mapped_column(ForeignKey("scrap_requests.id"), nullable=True, index=True)
    lot_id: Mapped[Optional[int]] = mapped_column(ForeignKey("material_lots.id"), nullable=True, index=True)
    stage: Mapped[str] = mapped_column(String(40))
    actor_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    note: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Notification(Base):
    __tablename__ = "notifications"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    message: Mapped[str] = mapped_column(Text)
    link: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Review(Base):
    __tablename__ = "reviews"
    id: Mapped[int] = mapped_column(primary_key=True)
    request_id: Mapped[int] = mapped_column(ForeignKey("scrap_requests.id"), unique=True)
    household_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    collector_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    rating: Mapped[int] = mapped_column(Integer)
    comment: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Complaint(Base):
    __tablename__ = "complaints"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    subject: Mapped[str] = mapped_column(String(120))
    body: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(12), default="open")  # open|resolved
    admin_note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id: Mapped[int] = mapped_column(primary_key=True)
    actor_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    action: Mapped[str] = mapped_column(String(60))
    target: Mapped[str] = mapped_column(String(120))
    detail: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
