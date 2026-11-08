import csv
import io
from collections import defaultdict
from datetime import timedelta

from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import MaterialLot, ScrapRequest, Transaction, User
from ..models import utcnow
from ..utils import category_label

router = APIRouter(tags=["analytics"])


def _records(user: User, db: Session) -> list[tuple]:
    """Returns (when, category, kg, amount) rows visible to this user's role."""
    rows = []
    if user.role in ("household", "collector", "admin"):
        q = db.query(Transaction)
        if user.role == "household":
            q = q.filter(Transaction.household_id == user.id)
        elif user.role == "collector":
            q = q.filter(Transaction.collector_id == user.id)
        rows = [(t.created_at, t.category, t.confirmed_quantity_kg, t.total_amount) for t in q.all()]
    elif user.role == "dealer":
        for lot in db.query(MaterialLot).filter(MaterialLot.dealer_id == user.id).all():
            rows.append((lot.updated_at, lot.category, lot.quantity_kg,
                         round(lot.quantity_kg * (lot.purchase_price_per_kg or 0), 2)))
    elif user.role == "recycler":
        for lot in db.query(MaterialLot).filter(MaterialLot.recycler_id == user.id,
                                                MaterialLot.status == "recycled").all():
            rows.append((lot.updated_at, lot.category, lot.recycled_quantity_kg or 0.0, 0.0))
    return rows


@router.get("/analytics/me")
def analytics_me(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = _records(user, db)
    monthly = defaultdict(lambda: {"kg": 0.0, "amount": 0.0})
    categories = defaultdict(float)
    for when, cat, kg, amount in rows:
        if when is None:
            continue
        monthly[when.strftime("%Y-%m")]["kg"] += kg
        monthly[when.strftime("%Y-%m")]["amount"] += amount
        categories[category_label(cat)] += kg
    today = utcnow().date()
    daily = {(today - timedelta(days=i)).isoformat(): 0.0 for i in range(6, -1, -1)}
    for when, _cat, _kg, amount in rows:
        if when is not None and when.date().isoformat() in daily:
            daily[when.date().isoformat()] += amount

    completion = None
    if user.role == "collector":
        assigned = db.query(ScrapRequest).filter(ScrapRequest.assigned_collector_id == user.id).count()
        done = db.query(ScrapRequest).filter(ScrapRequest.assigned_collector_id == user.id,
                                             ScrapRequest.status == "completed").count()
        completion = round(done / assigned * 100, 1) if assigned else None
    elif user.role == "admin":
        total = db.query(ScrapRequest).count()
        done = db.query(ScrapRequest).filter(ScrapRequest.status == "completed").count()
        completion = round(done / total * 100, 1) if total else None

    return {
        "role": user.role,
        "totals": {"kg": round(sum(r[2] for r in rows), 2), "amount": round(sum(r[3] for r in rows), 2),
                   "records": len(rows)},
        "monthly": [{"month": m, "kg": round(v["kg"], 2), "amount": round(v["amount"], 2)}
                    for m, v in sorted(monthly.items())],
        "daily_amount": [{"day": d, "amount": round(v, 2)} for d, v in daily.items()],
        "categories": [{"category": c, "kg": round(v, 2)} for c, v in categories.items()],
        "completion_rate_pct": completion,
    }


@router.get("/analytics/export.csv")
def export_csv(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["date", "category", "quantity_kg", "amount_inr"])
    for when, cat, kg, amount in _records(user, db):
        writer.writerow([when.date().isoformat() if when else "", category_label(cat), kg, amount])
    return Response(buf.getvalue(), media_type="text/csv",
                    headers={"Content-Disposition": "attachment; filename=kabadiwala-report.csv"})
