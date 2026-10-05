"""The closed loop: sense -> predict -> choose -> confirm -> deliver.

advance() moves a user's simulated clock forward in 5-minute steps. Each step
writes a reading, moves orders along (autopilot confirms, deliveries land and
become meals), scores hunger, and proposes an order when the score crosses the
user's threshold and their guardrails allow it.
"""

from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from . import hunger, recommender, simulator
from .models import Activity, HungerSnapshot, Meal, Order, OrderItem, Reading, Restaurant, User

STEP_MIN = 5
ACTIVE = ("proposed", "confirmed", "preparing", "on_the_way")
PLACED = ("confirmed", "preparing", "on_the_way", "delivered")
CONFIRM_WAIT_MIN = 15  # how long a proposal waits for a tap in confirm mode
COOLDOWN_MIN = 45  # quiet time after the user says "not now"
MIN_ORDER_CENTS = 1200


class OrderError(Exception):
    pass


def _meals(db: Session, user_id: int, until: datetime):
    return db.scalars(
        select(Meal).where(Meal.user_id == user_id, Meal.ts <= until).order_by(Meal.ts)
    ).all()


def _activities(db: Session, user_id: int):
    return db.scalars(select(Activity).where(Activity.user_id == user_id)).all()


def _readings(db: Session, user_id: int, since: datetime, until: datetime):
    return db.scalars(
        select(Reading)
        .where(Reading.user_id == user_id, Reading.ts > since, Reading.ts <= until)
        .order_by(Reading.ts)
    ).all()


def restaurants(db: Session):
    return db.scalars(
        select(Restaurant).options(selectinload(Restaurant.items)).order_by(Restaurant.id)
    ).all()


def make_reading(user: User, t: datetime, meals, activities) -> Reading:
    w = simulator.watch_at(user, t, activities, STEP_MIN)
    g = simulator.glucose_at(user, t, meals, activities) if "cgm" in user.devices else None
    return Reading(user_id=user.id, ts=t, glucose_mgdl=g, **w)


def score_at(db: Session, user: User, t: datetime) -> dict:
    meals = _meals(db, user.id, t)
    last = meals[-1].ts if meals else t - timedelta(hours=12)
    since = min(last, t - timedelta(minutes=35))
    readings = _readings(db, user.id, since, t)
    prev = db.scalar(
        select(HungerSnapshot)
        .where(HungerSnapshot.user_id == user.id, HungerSnapshot.ts <= t - timedelta(minutes=30))
        .order_by(HungerSnapshot.ts.desc())
        .limit(1)
    )
    return hunger.compute(user, t, readings, meals, prev.score if prev else None,
                          _activities(db, user.id))


def week_spend_cents(db: Session, user: User) -> int:
    since = user.sim_now - timedelta(days=7)
    orders = db.scalars(
        select(Order).where(
            Order.user_id == user.id, Order.status.in_(PLACED), Order.created_at > since
        )
    ).all()
    return sum(o.total_cents for o in orders)


def recommendations(db: Session, user: User, h: dict | None = None) -> dict:
    h = h or score_at(db, user, user.sim_now)
    budget_left = user.weekly_budget_cents - week_spend_cents(db, user)
    rec = recommender.recommend(user, h, restaurants(db), _activities(db, user.id), budget_left)
    rec["budget_left_cents"] = budget_left
    return rec


def active_order(db: Session, user: User) -> Order | None:
    return db.scalar(
        select(Order)
        .where(Order.user_id == user.id, Order.status.in_(ACTIVE))
        .order_by(Order.created_at.desc())
        .limit(1)
    )


def guardrail_block(db: Session, user: User, t: datetime) -> str | None:
    """Why the loop may not propose an order right now, or None if it may."""
    if user.mode == "off":
        return "Auto-ordering is off"
    if active_order(db, user):
        return "An order is already in progress"
    day_start = t.replace(hour=0, minute=0, second=0, microsecond=0)
    placed_today = db.scalars(
        select(Order).where(
            Order.user_id == user.id, Order.status.in_(PLACED), Order.created_at >= day_start
        )
    ).all()
    if len(placed_today) >= user.max_orders_per_day:
        return f"Daily cap of {user.max_orders_per_day} orders reached"
    recent_no = db.scalar(
        select(Order)
        .where(
            Order.user_id == user.id,
            Order.status.in_(("declined", "expired", "cancelled")),
            Order.created_at > t - timedelta(minutes=COOLDOWN_MIN),
        )
        .limit(1)
    )
    if recent_no:
        return "Waiting a bit after the last suggestion was turned down"
    if user.weekly_budget_cents - week_spend_cents(db, user) < MIN_ORDER_CENTS:
        return "Weekly budget is used up"
    return None


def create_order(db: Session, user: User, restaurant: Restaurant, items, *, trigger: str,
                 t: datetime, h: dict | None = None, status: str = "proposed") -> Order:
    subtotal = sum(i.price_cents for i in items)
    order = Order(
        user_id=user.id,
        restaurant_id=restaurant.id,
        status=status,
        trigger=trigger,
        hunger_score=h["score"] if h else None,
        reason=h["reason"] if h else "",
        subtotal_cents=subtotal,
        delivery_fee_cents=restaurant.delivery_fee_cents,
        total_cents=subtotal + restaurant.delivery_fee_cents,
        kcal=sum(i.kcal for i in items),
        protein_g=sum(i.protein_g for i in items),
        created_at=t,
        eta=t + timedelta(minutes=restaurant.prep_minutes + restaurant.travel_minutes),
        items=[OrderItem(menu_item_id=i.id, quantity=1, price_cents=i.price_cents) for i in items],
    )
    if status == "proposed":
        wait = user.cancel_window_min if user.mode == "autopilot" else CONFIRM_WAIT_MIN
        order.respond_by = t + timedelta(minutes=wait)
    db.add(order)
    db.flush()
    return order


def confirm(db: Session, order: Order, via: str, t: datetime):
    if order.status != "proposed":
        raise OrderError(f"Order is {order.status}, not waiting for confirmation")
    r = order.restaurant or db.get(Restaurant, order.restaurant_id)
    order.status = "confirmed"
    order.confirmed_via = via
    order.confirmed_at = t
    order.eta = t + timedelta(minutes=r.prep_minutes + r.travel_minutes)


def cancel(db: Session, order: Order, t: datetime):
    if order.status == "proposed":
        order.status = "declined"
    elif order.status in ("confirmed", "preparing"):
        order.status = "cancelled"
    else:
        raise OrderError(f"Order is {order.status} and can no longer be cancelled")


def progress_orders(db: Session, user: User, t: datetime) -> list[str]:
    events = []
    for o in db.scalars(
        select(Order).where(Order.user_id == user.id, Order.status.in_(ACTIVE))
    ).all():
        r = db.get(Restaurant, o.restaurant_id)
        if o.status == "proposed" and o.respond_by and t >= o.respond_by:
            if user.mode == "autopilot":
                confirm(db, o, "autopilot", o.respond_by)
                events.append(f"Autopilot placed order #{o.id}")
            else:
                o.status = "expired"
                events.append(f"Suggestion #{o.id} expired without an answer")
                continue
        if o.status in ("confirmed", "preparing", "on_the_way"):
            if t >= o.eta:
                o.status = "delivered"
                o.delivered_at = o.eta
                gly = max((it.menu_item.glycemic for it in o.items),
                          key=lambda g: recommender.GLYCEMIC_PENALTY[g])
                db.add(Meal(
                    user_id=user.id, ts=o.eta, label=r.name, kcal=o.kcal,
                    carbs_g=sum(it.menu_item.carbs_g for it in o.items),
                    glycemic=gly, source="order", order_id=o.id,
                ))
                events.append(f"Order #{o.id} delivered")
            elif t >= o.confirmed_at + timedelta(minutes=r.prep_minutes):
                o.status = "on_the_way"
            elif t >= o.confirmed_at + timedelta(minutes=2):
                o.status = "preparing"
    db.flush()
    return events


def maybe_propose(db: Session, user: User, h: dict) -> Order | None:
    if h["score"] < user.hunger_threshold or guardrail_block(db, user, h["ts"]):
        return None
    rec = recommendations(db, user, h)
    if not rec["options"]:
        return None
    best = rec["options"][0]
    return create_order(db, user, best["restaurant"], best["items"], trigger="signal", t=h["ts"], h=h)


def step(db: Session, user: User) -> list[str]:
    t = user.sim_now + timedelta(minutes=STEP_MIN)
    db.add(make_reading(user, t, _meals(db, user.id, t), _activities(db, user.id)))
    user.sim_now = t
    db.flush()
    events = progress_orders(db, user, t)
    h = score_at(db, user, t)
    db.add(HungerSnapshot(user_id=user.id, **h))
    order = maybe_propose(db, user, h)
    if order:
        events.append(f"Hunger {h['score']}: suggested order #{order.id}")
    return events


def advance(db: Session, user: User, minutes: int) -> list[str]:
    events = []
    for _ in range(max(1, minutes // STEP_MIN)):
        events += step(db, user)
    db.commit()
    return events
