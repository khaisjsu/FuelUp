import os

os.environ["DATABASE_URL"] = "sqlite://"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.db import SessionLocal, normalize_url  # noqa: E402
from app.main import app  # noqa: E402
from app.seed import seed  # noqa: E402

client = TestClient(app)
MAYA, JORDAN, PRIYA = 1, 2, 3


@pytest.fixture(autouse=True)
def fresh_data():
    with SessionLocal() as db:
        seed(db)


def advance(user_id, minutes):
    r = client.post(f"/api/sim/users/{user_id}/advance", json={"minutes": minutes})
    assert r.status_code == 200
    return r.json()["events"]


def test_users_and_state():
    users = client.get("/api/users").json()
    assert [u["name"] for u in users] == ["Maya Chen", "Jordan Reyes", "Priya Nair"]
    state = client.get(f"/api/users/{MAYA}/state").json()
    assert 0 <= state["hunger"]["score"] <= 100
    assert state["latest_reading"]["glucose_mgdl"] is not None
    assert state["recommendations"]["options"]


def test_watch_only_user_has_no_glucose():
    state = client.get(f"/api/users/{JORDAN}/state").json()
    assert state["latest_reading"]["glucose_mgdl"] is None
    assert state["hunger"]["factors"]["has_cgm"] is False


def test_glucose_dip_raises_hunger_and_proposes_meal():
    before = client.get(f"/api/users/{MAYA}/state").json()["hunger"]["score"]
    advance(MAYA, 75)
    state = client.get(f"/api/users/{MAYA}/state").json()
    assert state["hunger"]["score"] > before
    order = state["active_order"]
    assert order and order["status"] == "proposed" and order["trigger"] == "signal"
    assert order["reason"]


def test_confirm_on_watch_then_delivery_resets_hunger():
    advance(MAYA, 75)
    order = client.get(f"/api/users/{MAYA}/state").json()["active_order"]
    r = client.post(f"/api/orders/{order['id']}/confirm", json={"via": "watch_tap"})
    assert r.json()["status"] == "confirmed"
    advance(MAYA, 45)
    done = client.get(f"/api/orders/{order['id']}").json()
    assert done["status"] == "delivered"
    state = client.get(f"/api/users/{MAYA}/state").json()
    assert state["hunger"]["score"] < 30
    assert any(m["source"] == "order" for m in state["today"]["meals"])


def test_autopilot_places_order_after_cancel_window():
    events = advance(JORDAN, 45)
    assert any("Autopilot placed" in e for e in events)


def test_declining_starts_cooldown():
    advance(PRIYA, 5)
    order = client.get(f"/api/users/{PRIYA}/state").json()["active_order"]
    assert client.post(f"/api/orders/{order['id']}/cancel").json()["status"] == "declined"
    advance(PRIYA, 20)
    state = client.get(f"/api/users/{PRIYA}/state").json()
    assert state["active_order"] is None
    assert "turned down" in state["guardrail"]


def test_recommendations_respect_allergies_and_diet():
    restaurants = {r["id"]: r for r in client.get("/api/restaurants").json()}
    assert restaurants
    recs = client.get(f"/api/users/{PRIYA}/recommendations").json()["options"]
    for opt in recs:
        for item in opt["items"]:
            assert "tree-nut" not in item["allergens"]
            assert {"vegetarian", "vegan"} & set(item["tags"])


def test_mode_off_never_orders():
    client.patch(f"/api/users/{PRIYA}", json={"mode": "off"})
    advance(PRIYA, 60)
    assert client.get(f"/api/users/{PRIYA}/state").json()["active_order"] is None


def test_manual_order_and_admin_stats():
    r = client.get("/api/restaurants").json()[0]
    o = client.post(f"/api/users/{MAYA}/orders",
                    json={"restaurant_id": r["id"], "menu_item_ids": [r["items"][0]["id"]]})
    assert o.status_code == 201 and o.json()["status"] == "confirmed"
    stats = client.get("/api/admin/stats").json()
    assert stats["totals"]["placed"] >= 1
    assert stats["recent_orders"][0]["id"] == o.json()["id"]


def test_hosted_database_urls_use_psycopg():
    assert normalize_url("postgres://u:p@h/db") == "postgresql+psycopg://u:p@h/db"
    assert normalize_url("postgresql://u:p@h/db") == "postgresql+psycopg://u:p@h/db"
    assert normalize_url("sqlite://") == "sqlite://"


def test_reset_and_health():
    assert client.get("/api/health").json() == {"ok": True}
    assert client.post("/api/sim/reset").json() == {"ok": True}
    assert len(client.get("/api/users").json()) == 3
