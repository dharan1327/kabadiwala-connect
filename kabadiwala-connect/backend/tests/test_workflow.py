"""End-to-end test of the demonstration workflow. Run from /backend: pytest -q"""
import io
import os
import tempfile

os.environ["AUTH_MODE"] = "dev"
os.environ["SEED_DEMO"] = "true"
os.environ.setdefault("DATABASE_URL", "sqlite:///./test_kabadiwala.db")
os.environ["UPLOAD_DIR"] = tempfile.mkdtemp()
if os.path.exists("test_kabadiwala.db"):
    os.remove("test_kabadiwala.db")

from fastapi.testclient import TestClient  # noqa: E402
from PIL import Image  # noqa: E402

from app.main import app  # noqa: E402

HOUSE, COLL, COLL2 = "household@demo.kc", "collector@demo.kc", "collector2@demo.kc"
DEALER, RECYCLER, ADMIN = "dealer@demo.kc", "recycler@demo.kc", "admin@demo.kc"


def H(email):
    return {"X-Dev-Email": email}


def test_full_demonstration_workflow():
    with TestClient(app) as c:
        # Household uploads a photograph; with no trained model the AI reports "unavailable" (never fabricated).
        buf = io.BytesIO()
        Image.new("RGB", (64, 64), (120, 200, 90)).save(buf, format="PNG")
        r = c.post("/api/scrap/images", files={"file": ("scrap.png", buf.getvalue(), "image/png")}, headers=H(HOUSE))
        assert r.status_code == 201, r.text
        image_id = r.json()["image_id"]
        cls = c.post(f"/api/scrap/images/{image_id}/classify", headers=H(HOUSE)).json()
        assert cls["status"] == "unavailable" and cls["category"] is None

        # Household submits a pickup request (manual category).
        body = {"category": "circuit_boards", "est_quantity_kg": 3.0,
                "pickup_address": "12 Demo Street, Chennai", "pickup_lat": 13.0827, "pickup_lng": 80.2707,
                "preferred_date": "2026-11-10", "preferred_time": "10:00", "image_id": image_id}
        r = c.post("/api/requests", json=body, headers=H(HOUSE))
        assert r.status_code == 201, r.text
        req = r.json()
        assert req["category_source"] == "manual" and req["status"] == "open"

        # Nearby collector sees the request, but NOT the address before accepting.
        nearby = c.get("/api/requests/nearby", headers=H(COLL)).json()
        item = next(x for x in nearby if x["id"] == req["id"])
        assert "pickup_address" not in item

        # Collector submits an offer; a second active offer from the same collector is refused.
        r = c.post(f"/api/requests/{req['id']}/offers", json={"price_per_kg": 180, "message": "Today"}, headers=H(COLL))
        assert r.status_code == 201 and r.json()["flagged"] is False
        offer_id = r.json()["id"]
        assert c.post(f"/api/requests/{req['id']}/offers", json={"price_per_kg": 181}, headers=H(COLL)).status_code == 409

        # Household compares offers and accepts.
        offers = c.get(f"/api/requests/{req['id']}/offers", headers=H(HOUSE)).json()
        assert offers["offers"][0]["id"] == offer_id
        r = c.post(f"/api/offers/{offer_id}/accept", json={}, headers=H(HOUSE))
        assert r.status_code == 200 and r.json()["status"] == "scheduled"

        # Now the assigned collector can see the pickup address; a rival collector cannot.
        assigned = c.get("/api/pickups/assigned", headers=H(COLL)).json()
        assert assigned[0]["pickup_address"] == "12 Demo Street, Chennai"
        assert c.get(f"/api/requests/{req['id']}", headers=H(COLL2)).status_code == 403

        # Completion requires the material to be marked collected first.
        done_body = {"confirmed_quantity_kg": 2.5, "price_per_kg": 175}
        assert c.post(f"/api/requests/{req['id']}/complete", json=done_body, headers=H(COLL)).status_code == 409
        assert c.post(f"/api/requests/{req['id']}/status", json={"status": "arriving"}, headers=H(COLL)).status_code == 200
        assert c.post(f"/api/requests/{req['id']}/status", json={"status": "collected"}, headers=H(COLL)).status_code == 200
        r = c.post(f"/api/requests/{req['id']}/complete", json=done_body, headers=H(COLL))
        assert r.status_code == 201, r.text
        txn = r.json()
        assert txn["total_amount"] == 437.5 and txn["handover_ref"].startswith("KC-HO")

        # Dealer buys the lot, dispatches it to an authorised recycler.
        lots = c.get("/api/market/lots?category=circuit_boards", headers=H(DEALER)).json()
        lot = next(x for x in lots if x["transaction_ref"] == txn["public_ref"])
        assert c.post(f"/api/market/lots/{lot['id']}/purchase", json={"price_per_kg": 170}, headers=H(DEALER)).status_code == 200
        recycler_id = c.get("/api/market/recyclers", headers=H(DEALER)).json()[0]["id"]
        assert c.post(f"/api/market/lots/{lot['id']}/dispatch", json={"recycler_id": recycler_id},
                      headers=H(DEALER)).status_code == 200

        # Recycling unit receives, processes, and confirms recycled quantity.
        assert c.post(f"/api/market/lots/{lot['id']}/receive", json={"inspection": "pass", "received_quantity_kg": 2.5},
                      headers=H(RECYCLER)).status_code == 200
        assert c.post(f"/api/market/lots/{lot['id']}/process", json={"status": "processing"},
                      headers=H(RECYCLER)).status_code == 200
        assert c.post(f"/api/market/lots/{lot['id']}/process", json={"status": "recycled", "recycled_quantity_kg": 9.9},
                      headers=H(RECYCLER)).status_code == 400  # cannot exceed received quantity
        r = c.post(f"/api/market/lots/{lot['id']}/process", json={"status": "recycled", "recycled_quantity_kg": 2.4},
                   headers=H(RECYCLER))
        assert r.status_code == 200 and r.json()["status"] == "recycled"

        # Tracking timeline and access control.
        detail = c.get(f"/api/transactions/{txn['id']}", headers=H(HOUSE)).json()
        stages = [e["stage"] for e in detail["timeline"]]
        assert "transaction_completed" in stages and "recycled" in stages
        assert c.get(f"/api/transactions/{txn['id']}", headers=H(COLL2)).status_code == 403
        assert c.get("/api/admin/stats", headers=H(HOUSE)).status_code == 403
        assert c.get("/api/admin/stats", headers=H(ADMIN)).status_code == 200

        # Rating, analytics, export.
        assert c.post(f"/api/requests/{req['id']}/review", json={"rating": 5}, headers=H(HOUSE)).status_code == 201
        assert c.get("/api/analytics/me", headers=H(COLL)).json()["totals"]["records"] >= 1
        assert c.get("/api/analytics/export.csv", headers=H(COLL)).status_code == 200


def test_unauthenticated_and_suspended_access():
    with TestClient(app) as c:
        assert c.get("/api/auth/me").status_code == 401
        assert c.get("/api/auth/me", headers=H("nobody@example.com")).status_code == 403
        assert c.get("/api/prices/current").json()[0]["is_sample"] is True
