import os
from collections import Counter
from contextlib import asynccontextmanager
from datetime import timedelta
from typing import Literal

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field
from sqlalchemy import func, inspect, select
from sqlalchemy.orm import Session

from . import engine as loop
from . import serialize as s
from .db import SessionLocal, engine, get_db
from .models import Activity, HungerSnapshot, Meal, MenuItem, Order, Reading, Restaurant, User
from .seed import seed

@asynccontextmanager
async def lifespan(_app):
    seed_if_empty()
    yield


app = FastAPI(
    lifespan=lifespan,
    title="Fuelcast API",
    description="Hands-free food ordering prototype. All health data is simulated.",
    version="0.1.0",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


def seed_if_empty():
    if os.getenv("AUTO_SEED", "1") != "1":
        return
    if not inspect(engine).has_table("users"):
        with SessionLocal() as db:
            seed(db)
        return
    with SessionLocal() as db:
        if not db.scalar(select(func.count(User.id))):
            seed(db)


def get_user(user_id: int, db: Session = Depends(get_db)) -> User:
    u = db.get(User, user_id)
    if not u:
        raise HTTPException(404, "User not found")
    return u


def get_order(order_id: int, db: Session = Depends(get_db)) -> Order:
    o = db.get(Order, order_id)
    if not o:
        raise HTTPException(404, "Order not found")
    return o


# ---------- meta ----------

@app.get("/", include_in_schema=False)
def root():
    return RedirectResponse("/docs")


@app.get("/api/health")
def health():
    return {"ok": True}


# ---------- users ----------

@app.get("/api/users")
def list_users(db: Session = Depends(get_db)):
    return [s.user(u) for u in db.scalars(select(User).order_by(User.id))]


@app.get("/api/users/{user_id}")
def read_user(u: User = Depends(get_user)):
    return s.user(u)


class SettingsIn(BaseModel):
    mode: Literal["off", "confirm", "autopilot"] | None = None
    hunger_threshold: int | None = Field(None, ge=30, le=95)
    weekly_budget_cents: int | None = Field(None, ge=0)
    max_orders_per_day: int | None = Field(None, ge=0, le=6)
    cancel_window_min: int | None = Field(None, ge=1, le=30)
    allergies: list[str] | None = None
    diet: list[str] | None = None
    delivery_address: str | None = None


@app.patch("/api/users/{user_id}")
def update_settings(body: SettingsIn, u: User = Depends(get_user), db: Session = Depends(get_db)):
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(u, k, v)
    db.commit()
    return s.user(u)


@app.get("/api/users/{user_id}/state")
def user_state(u: User = Depends(get_user), db: Session = Depends(get_db)):
    """Everything the phone, watch and dashboard need in one call."""
    latest = db.scalar(
        select(Reading).where(Reading.user_id == u.id).order_by(Reading.ts.desc()).limit(1)
    )
    h = loop.score_at(db, u, u.sim_now)
    rec = loop.recommendations(db, u, h)
    active = loop.active_order(db, u)
    day_start = u.sim_now.replace(hour=0, minute=0)
    eaten = db.scalars(select(Meal).where(Meal.user_id == u.id, Meal.ts >= day_start, Meal.ts <= u.sim_now)).all()
    burned_active = db.scalar(
        select(func.coalesce(func.sum(Reading.active_kcal), 0)).where(
            Reading.user_id == u.id, Reading.ts >= day_start, Reading.ts <= u.sim_now)
    )
    mins_today = (u.sim_now - day_start).total_seconds() / 60
    return {
        "user": s.user(u),
        "now": u.sim_now,
        "latest_reading": s.reading(latest) if latest else None,
        "hunger": h,
        "guardrail": loop.guardrail_block(db, u, u.sim_now),
        "recommendations": {**rec, "options": [s.option(o) for o in rec["options"]]},
        "active_order": s.order(active) if active else None,
        "today": {
            "eaten_kcal": sum(m.kcal for m in eaten),
            "burned_kcal": int(u.bmr_kcal_day / 1440 * mins_today + float(burned_active)),
            "meals": [{"ts": m.ts, "label": m.label, "kcal": m.kcal, "source": m.source} for m in eaten],
        },
        "week_spend_cents": loop.week_spend_cents(db, u),
    }


@app.get("/api/users/{user_id}/readings")
def readings(hours: int = 12, u: User = Depends(get_user), db: Session = Depends(get_db)):
    since = u.sim_now - timedelta(hours=hours)
    rows = db.scalars(
        select(Reading).where(Reading.user_id == u.id, Reading.ts > since, Reading.ts <= u.sim_now)
        .order_by(Reading.ts)
    )
    return [s.reading(r) for r in rows]


@app.get("/api/users/{user_id}/hunger/history")
def hunger_history(hours: int = 12, u: User = Depends(get_user), db: Session = Depends(get_db)):
    since = u.sim_now - timedelta(hours=hours)
    rows = db.scalars(
        select(HungerSnapshot)
        .where(HungerSnapshot.user_id == u.id, HungerSnapshot.ts > since, HungerSnapshot.ts <= u.sim_now)
        .order_by(HungerSnapshot.ts)
    )
    return [{"ts": r.ts, "score": r.score, "reason": r.reason} for r in rows]


@app.get("/api/users/{user_id}/recommendations")
def recs(u: User = Depends(get_user), db: Session = Depends(get_db)):
    rec = loop.recommendations(db, u)
    return {**rec, "options": [s.option(o) for o in rec["options"]]}


@app.get("/api/users/{user_id}/orders")
def user_orders(limit: int = 20, u: User = Depends(get_user), db: Session = Depends(get_db)):
    rows = db.scalars(
        select(Order).where(Order.user_id == u.id).order_by(Order.created_at.desc()).limit(limit)
    )
    return [s.order(o) for o in rows]


class ManualOrderIn(BaseModel):
    restaurant_id: int
    menu_item_ids: list[int] = Field(min_length=1)


@app.post("/api/users/{user_id}/orders", status_code=201)
def place_order(body: ManualOrderIn, u: User = Depends(get_user), db: Session = Depends(get_db)):
    """Order something by hand (or accept one of the recommendations)."""
    if loop.active_order(db, u):
        raise HTTPException(409, "An order is already in progress")
    r = db.get(Restaurant, body.restaurant_id)
    if not r:
        raise HTTPException(404, "Restaurant not found")
    items = [db.get(MenuItem, i) for i in body.menu_item_ids]
    if any(i is None or i.restaurant_id != r.id for i in items):
        raise HTTPException(422, "Every item must exist and come from that restaurant")
    o = loop.create_order(db, u, r, items, trigger="manual", t=u.sim_now, status="proposed")
    loop.confirm(db, o, "phone", u.sim_now)
    db.commit()
    return s.order(o)


# ---------- orders ----------

@app.get("/api/orders/{order_id}")
def read_order(o: Order = Depends(get_order)):
    return s.order(o)


class ConfirmIn(BaseModel):
    via: Literal["watch_tap", "voice", "phone"] = "watch_tap"


@app.post("/api/orders/{order_id}/confirm")
def confirm_order(body: ConfirmIn, o: Order = Depends(get_order), db: Session = Depends(get_db)):
    u = db.get(User, o.user_id)
    try:
        loop.confirm(db, o, body.via, u.sim_now)
    except loop.OrderError as e:
        raise HTTPException(409, str(e))
    db.commit()
    return s.order(o)


@app.post("/api/orders/{order_id}/cancel")
def cancel_order(o: Order = Depends(get_order), db: Session = Depends(get_db)):
    u = db.get(User, o.user_id)
    try:
        loop.cancel(db, o, u.sim_now)
    except loop.OrderError as e:
        raise HTTPException(409, str(e))
    db.commit()
    return s.order(o)


# ---------- restaurants ----------

@app.get("/api/restaurants")
def list_restaurants(db: Session = Depends(get_db)):
    return [s.restaurant(r, with_items=True) for r in loop.restaurants(db)]


@app.get("/api/restaurants/{restaurant_id}")
def read_restaurant(restaurant_id: int, db: Session = Depends(get_db)):
    r = db.get(Restaurant, restaurant_id)
    if not r:
        raise HTTPException(404, "Restaurant not found")
    return s.restaurant(r, with_items=True)


# ---------- simulator ----------

class AdvanceIn(BaseModel):
    minutes: int = Field(15, ge=5, le=240)


@app.post("/api/sim/users/{user_id}/advance")
def sim_advance(body: AdvanceIn, u: User = Depends(get_user), db: Session = Depends(get_db)):
    """Move this user's simulated clock forward; the loop runs every 5 minutes."""
    events = loop.advance(db, u, body.minutes)
    return {"now": u.sim_now, "events": events}


class WorkoutIn(BaseModel):
    minutes: int = Field(45, ge=10, le=180)
    kind: str = "Run"
    intensity: Literal["easy", "moderate", "hard"] = "moderate"


@app.post("/api/sim/users/{user_id}/workout", status_code=201)
def sim_workout(body: WorkoutIn, u: User = Depends(get_user), db: Session = Depends(get_db)):
    """Start a simulated workout at the user's current time."""
    kcal, hr = {"easy": (6.0, 118), "moderate": (9.0, 138), "hard": (12.5, 158)}[body.intensity]
    a = Activity(user_id=u.id, kind=body.kind, start=u.sim_now,
                 end=u.sim_now + timedelta(minutes=body.minutes), kcal_per_min=kcal, heart_rate=hr)
    db.add(a)
    db.commit()
    return {"kind": a.kind, "start": a.start, "end": a.end}


class MealIn(BaseModel):
    label: str = "Snack"
    kcal: int = Field(300, ge=20, le=2000)
    carbs_g: int = Field(35, ge=0, le=300)
    glycemic: Literal["low", "medium", "high"] = "medium"


@app.post("/api/sim/users/{user_id}/meal", status_code=201)
def sim_meal(body: MealIn, u: User = Depends(get_user), db: Session = Depends(get_db)):
    """Log something the user ate outside the app."""
    m = Meal(user_id=u.id, ts=u.sim_now, source="logged", **body.model_dump())
    db.add(m)
    db.commit()
    return {"ts": m.ts, "label": m.label, "kcal": m.kcal}


@app.post("/api/sim/reset")
def sim_reset(db: Session = Depends(get_db)):
    """Wipe everything and reload the demo data. Set ALLOW_RESET=0 to turn this off."""
    if os.getenv("ALLOW_RESET", "1") != "1":
        raise HTTPException(403, "Reset is turned off on this server")
    db.close()
    with SessionLocal() as fresh:
        seed(fresh)
    return {"ok": True}


# ---------- ops dashboard ----------

@app.get("/api/admin/stats")
def admin_stats(db: Session = Depends(get_db)):
    orders = db.scalars(select(Order).order_by(Order.created_at.desc())).all()
    by_status = Counter(o.status for o in orders)
    placed = [o for o in orders if o.status in loop.PLACED]
    delivered = [o for o in orders if o.status == "delivered"]
    signal = [o for o in orders if o.trigger == "signal"]
    answered = [o for o in signal if o.status not in ("proposed", "expired")]
    accepted = [o for o in answered if o.status in loop.PLACED]
    lead = [(o.delivered_at - o.created_at).total_seconds() / 60 for o in delivered if o.delivered_at]
    item_counts = Counter(it.menu_item.name for o in placed for it in o.items)
    by_day = Counter(o.created_at.date().isoformat() for o in placed)
    gmv_by_day = Counter()
    for o in placed:
        gmv_by_day[o.created_at.date().isoformat()] += o.total_cents
    users = db.scalars(select(User).order_by(User.id)).all()
    per_user = []
    for u in users:
        mine = [o for o in placed if o.user_id == u.id]
        h = loop.score_at(db, u, u.sim_now)
        per_user.append({
            "user": {"id": u.id, "name": u.name, "mode": u.mode, "avatar_color": u.avatar_color,
                     "devices": u.devices},
            "orders": len(mine),
            "spend_cents": sum(o.total_cents for o in mine),
            "current_hunger": h["score"],
            "now": u.sim_now,
        })
    return {
        "totals": {
            "users": len(users),
            "restaurants": db.scalar(select(func.count(Restaurant.id))),
            "orders": len(orders),
            "placed": len(placed),
            "gmv_cents": sum(o.total_cents for o in placed),
            "avg_order_cents": int(sum(o.total_cents for o in placed) / len(placed)) if placed else 0,
            "signal_share": round(len([o for o in placed if o.trigger == "signal"]) / len(placed), 3) if placed else 0,
            "acceptance_rate": round(len(accepted) / len(answered), 3) if answered else 0,
            "avg_hunger_at_trigger": round(sum(o.hunger_score or 0 for o in signal) / len(signal), 1) if signal else 0,
            "avg_minutes_to_door": round(sum(lead) / len(lead), 1) if lead else 0,
        },
        "by_status": dict(by_status),
        "confirmed_via": dict(Counter(o.confirmed_via for o in placed if o.confirmed_via)),
        "orders_by_day": [{"day": d, "orders": by_day[d], "gmv_cents": gmv_by_day[d]} for d in sorted(by_day)],
        "top_items": [{"name": n, "count": c} for n, c in item_counts.most_common(6)],
        "users": per_user,
        "recent_orders": [s.order(o) | {"user_name": next(u.name for u in users if u.id == o.user_id)}
                          for o in orders[:15]],
    }
