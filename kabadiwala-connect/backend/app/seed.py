"""Demonstration data. Every record is labelled as sample data. Run via SEED_DEMO=true or `python -m app.seed`."""
from sqlalchemy.orm import Session

from .config import settings
from .models import CollectorProfile, Organization, ReferencePrice, User
from .routers.auth_routes import _next_collector_code

SAMPLE_LABEL = "SAMPLE – demonstration only, not market data"

DEMO_USERS = [
    dict(email="household@demo.kc", full_name="Demo Household", role="household", phone="9000000001",
         address="Sample address, 12 Demo Street", city="Chennai", pin_code="600001", lat=13.0827, lng=80.2707),
    dict(email="collector@demo.kc", full_name="Ravi Kumar (Demo Kabadiwala)", role="collector", phone="9000000002",
         address="Sample address, Demo Lane", city="Chennai", pin_code="600002", lat=13.0900, lng=80.2800),
    dict(email="collector2@demo.kc", full_name="Lakshmi (Demo Kabadiwala)", role="collector", phone="9000000003",
         address="Sample address, Demo Nagar", city="Chennai", pin_code="600003", lat=13.0600, lng=80.2500),
    dict(email="dealer@demo.kc", full_name="Demo Dealer", role="dealer", phone="9000000004",
         address="Sample address, Demo Market", city="Chennai", pin_code="600004", lat=13.0700, lng=80.2600,
         org="Demo Scrap Traders (sample)"),
    dict(email="recycler@demo.kc", full_name="Demo Recycler", role="recycler", phone="9000000005",
         address="Sample address, Demo Industrial Estate", city="Chennai", pin_code="600005", lat=13.0100,
         lng=80.2200, org="Demo E-Waste Recycling Unit (sample)"),
    dict(email="admin@demo.kc", full_name="Demo Administrator", role="admin", phone="9000000006",
         address="Sample address, Head Office", city="Chennai", pin_code="600006", lat=None, lng=None),
]

SAMPLE_PRICES = {
    "paper": 12, "cardboard": 10, "plastic": 15, "mixed_plastics": 6, "iron": 28, "aluminium": 110,
    "copper": 620, "glass": 2, "circuit_boards": 180, "cables": 90, "batteries": 60, "screens": 25,
    "motors": 150, "other": 5,
}


def seed_demo_data(db: Session) -> None:
    if db.query(User).filter(User.email == "household@demo.kc").first():
        return
    for spec in DEMO_USERS:
        org_name = spec.pop("org", None)
        user = User(uid=f"dev-{spec['email']}", **spec)
        db.add(user)
        db.flush()
        if spec["role"] == "collector":
            db.add(CollectorProfile(user_id=user.id, collector_code=_next_collector_code(db, user.city),
                                    service_radius_km=settings.match_radius_km, verification_status="unverified"))
        if org_name:
            db.add(Organization(user_id=user.id, name=org_name, kind=spec["role"], authorized=True))
    if not db.query(ReferencePrice).first():
        for code, price in SAMPLE_PRICES.items():
            db.add(ReferencePrice(category=code, price_per_kg=price, source=SAMPLE_LABEL))
    db.commit()


if __name__ == "__main__":
    from .database import Base, SessionLocal, engine

    Base.metadata.create_all(bind=engine)
    with SessionLocal() as session:
        seed_demo_data(session)
    print("Demo data seeded. Accounts:", ", ".join(u["email"] for u in DEMO_USERS))
