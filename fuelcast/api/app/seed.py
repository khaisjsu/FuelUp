"""Demo data: three personas, six partner kitchens, a morning of simulated
signals for each persona, and a week of past orders for the ops dashboard.

Run with `python -m app.seed` (drops and recreates every table).
"""

import random
from datetime import date, datetime, time, timedelta

from sqlalchemy.orm import Session

from . import engine as loop
from .db import Base, SessionLocal, engine
from .models import Activity, HungerSnapshot, Meal, MenuItem, Order, Restaurant, User

# (name, cuisine, rating, prep, travel, partner, fee, items)
# item: (name, description, price, kcal, protein, carbs, fat, fiber, glycemic, allergens, tags)
RESTAURANTS = [
    ("Green Fork Kitchen", "Bowls", 4.8, 10, 14, "DoorDash Drive", 299, [
        ("Salmon quinoa bowl", "Roast salmon, quinoa, greens, miso dressing", 1695, 610, 42, 48, 24, 7, "low", ["fish", "soy"], ["high-protein"]),
        ("Chicken power bowl", "Grilled chicken, brown rice, black beans, salsa", 1495, 640, 48, 62, 18, 11, "low", [], ["high-protein"]),
        ("Tofu harvest bowl", "Crispy tofu, farro, roast squash, tahini", 1395, 560, 26, 64, 20, 12, "low", ["soy", "sesame", "gluten"], ["vegan", "vegetarian"]),
        ("Edamame", "Steamed, sea salt", 495, 190, 17, 14, 8, 8, "low", ["soy"], ["side", "vegan", "vegetarian"]),
    ]),
    ("Ember Grill", "Mediterranean", 4.6, 12, 16, "Uber Direct", 349, [
        ("Chicken shawarma plate", "Chicken, saffron rice, salad, garlic sauce", 1595, 780, 52, 70, 30, 6, "medium", ["egg"], ["high-protein"]),
        ("Falafel plate", "Falafel, hummus, tabbouleh, pita", 1395, 720, 22, 88, 30, 14, "medium", ["sesame", "gluten"], ["vegan", "vegetarian"]),
        ("Lamb kofta wrap", "Spiced lamb, tzatziki, pickles", 1495, 690, 38, 52, 34, 5, "medium", ["dairy", "gluten"], []),
        ("Hummus & crudites", "Hummus with raw vegetables", 595, 240, 8, 22, 14, 7, "low", ["sesame"], ["side", "vegan", "vegetarian"]),
    ]),
    ("Tokyo Box", "Japanese", 4.5, 14, 18, "DoorDash Drive", 299, [
        ("Teriyaki chicken bento", "Chicken, white rice, pickles, salad", 1550, 720, 44, 92, 16, 4, "high", ["soy", "gluten"], ["high-protein"]),
        ("Ahi poke bowl", "Tuna, brown rice, avocado, seaweed", 1795, 620, 38, 66, 20, 8, "medium", ["fish", "soy", "sesame"], ["high-protein"]),
        ("Veggie sushi set", "Avocado, cucumber and sweet potato rolls", 1295, 520, 12, 96, 9, 7, "high", ["soy", "sesame"], ["vegan", "vegetarian"]),
        ("Miso soup", "Tofu, wakame, scallion", 395, 80, 6, 8, 3, 1, "low", ["soy"], ["side", "vegetarian"]),
    ]),
    ("Slice Republic", "Pizza & pasta", 4.3, 15, 15, "Uber Direct", 249, [
        ("Margherita pizza", "Tomato, mozzarella, basil", 1695, 980, 40, 120, 34, 6, "high", ["dairy", "gluten"], ["vegetarian"]),
        ("Penne arrabbiata", "Spicy tomato sauce, parmesan", 1395, 760, 24, 118, 20, 8, "high", ["dairy", "gluten"], ["vegetarian"]),
        ("Chicken pesto pasta", "Grilled chicken, basil pesto, pine nuts", 1695, 880, 50, 86, 36, 6, "high", ["dairy", "gluten", "tree-nut"], ["high-protein"]),
    ]),
    ("Protein Lab", "Fitness meals", 4.7, 8, 12, "DoorDash Drive", 299, [
        ("Steak & sweet potato", "Flank steak, sweet potato, broccoli", 1895, 690, 55, 52, 26, 9, "low", [], ["high-protein"]),
        ("Turkey chili", "Lean turkey, beans, peppers", 1295, 520, 44, 40, 16, 13, "low", [], ["high-protein"]),
        ("Egg white veggie wrap", "Egg whites, spinach, feta, whole wheat", 1095, 430, 34, 38, 12, 6, "medium", ["egg", "dairy", "gluten"], ["vegetarian", "high-protein"]),
        ("Greek yogurt parfait", "Yogurt, berries, granola", 695, 280, 20, 34, 6, 3, "medium", ["dairy", "tree-nut"], ["side", "vegetarian"]),
        ("Chocolate protein shake", "Whey, banana, cacao", 795, 330, 32, 34, 7, 3, "medium", ["dairy"], ["side", "vegetarian"]),
    ]),
    ("Saffron House", "Indian", 4.6, 16, 17, "Uber Direct", 349, [
        ("Chana masala & brown rice", "Chickpea curry, brown rice", 1395, 640, 22, 96, 16, 16, "low", [], ["vegan", "vegetarian"]),
        ("Tandoori chicken plate", "Tandoori chicken, kachumber, dal", 1695, 660, 56, 40, 26, 9, "low", ["dairy"], ["high-protein"]),
        ("Paneer tikka bowl", "Paneer, peppers, basmati, mint chutney", 1595, 740, 32, 70, 34, 6, "medium", ["dairy"], ["vegetarian"]),
        ("Masoor dal cup", "Red lentil soup", 495, 210, 13, 30, 4, 8, "low", [], ["side", "vegan", "vegetarian"]),
    ]),
]


def at(day: date, hhmm: str) -> datetime:
    h, m = map(int, hhmm.split(":"))
    return datetime.combine(day, time(h, m))


def backfill(db: Session, user: User, start: datetime, end: datetime):
    """Write readings and hunger snapshots for [start, end] without placing orders."""
    user.sim_now = start
    meals = db.query(Meal).filter(Meal.user_id == user.id).all()
    acts = db.query(Activity).filter(Activity.user_id == user.id).all()
    t = start
    while t < end:
        t += timedelta(minutes=loop.STEP_MIN)
        db.add(loop.make_reading(user, t, [m for m in meals if m.ts <= t], acts))
        db.flush()
        db.add(HungerSnapshot(user_id=user.id, **loop.score_at(db, user, t)))
    user.sim_now = end
    db.flush()


def seed(db: Session, today: date | None = None):
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    today = today or date.today()

    rests = []
    for name, cuisine, rating, prep, travel, partner, fee, items in RESTAURANTS:
        r = Restaurant(name=name, cuisine=cuisine, rating=rating, prep_minutes=prep,
                       travel_minutes=travel, delivery_partner=partner, delivery_fee_cents=fee)
        for (n, d, p, k, pr, c, f, fi, g, al, tg) in items:
            r.items.append(MenuItem(name=n, description=d, price_cents=p, kcal=k, protein_g=pr,
                                    carbs_g=c, fat_g=f, fiber_g=fi, glycemic=g, allergens=al, tags=tg))
        db.add(r)
        rests.append(r)

    maya = User(
        name="Maya Chen", email="maya@example.com", avatar_color="#0f766e",
        persona="Product designer who wears a Stelo CGM to keep her energy steady",
        devices=["cgm", "watch"], weight_kg=61, bmr_kcal_day=1380, glucose_baseline=90,
        daily_kcal_target=1900, protein_target_g=95, mode="confirm", allergies=["peanut"],
        weekly_budget_cents=17500,
        delivery_address="410 Townsend St, San Francisco", sim_now=at(today, "14:00"),
    )
    jordan = User(
        name="Jordan Reyes", email="jordan@example.com", avatar_color="#b45309",
        persona="Amateur triathlete who trains at lunch and forgets to refuel",
        devices=["watch", "ring"], weight_kg=78, bmr_kcal_day=1780, glucose_baseline=88,
        daily_kcal_target=2900, protein_target_g=160, mode="autopilot", hunger_threshold=65,
        weekly_budget_cents=22000, allergies=[], delivery_address="1 Ferry Building, San Francisco",
        sim_now=at(today, "13:15"),
    )
    priya = User(
        name="Priya Nair", email="priya@example.com", avatar_color="#7c3aed",
        persona="ICU nurse on a 12-hour shift who skips lunch on busy days",
        devices=["cgm", "watch"], weight_kg=58, bmr_kcal_day=1340, glucose_baseline=94,
        daily_kcal_target=2000, protein_target_g=90, mode="confirm", diet=["vegetarian"],
        allergies=["tree-nut"], weekly_budget_cents=17500, delivery_address="UCSF Medical Center, 505 Parnassus Ave",
        sim_now=at(today, "13:15"),
    )
    db.add_all([maya, jordan, priya])
    db.flush()

    db.add_all([
        Meal(user_id=maya.id, ts=at(today, "07:40"), label="Breakfast", kcal=420, carbs_g=45, glycemic="medium", source="logged"),
        Meal(user_id=maya.id, ts=at(today, "12:10"), label="Lunch", kcal=650, carbs_g=95, glycemic="high", source="logged"),
        Meal(user_id=jordan.id, ts=at(today, "07:00"), label="Breakfast", kcal=650, carbs_g=80, glycemic="medium", source="logged"),
        Meal(user_id=jordan.id, ts=at(today, "11:00"), label="Snack", kcal=280, carbs_g=35, glycemic="medium", source="logged"),
        Activity(user_id=jordan.id, kind="Bike intervals", start=at(today, "12:30"), end=at(today, "13:45"),
                 kcal_per_min=11.5, heart_rate=152),
        Meal(user_id=priya.id, ts=at(today, "06:15"), label="Breakfast", kcal=320, carbs_g=48, glycemic="high", source="logged"),
        Activity(user_id=priya.id, kind="Ward rounds", start=at(today, "09:00"), end=at(today, "11:30"),
                 kcal_per_min=3.2, heart_rate=98),
    ])
    db.flush()

    for u in (maya, jordan, priya):
        backfill(db, u, at(today, "06:00"), u.sim_now)

    # A week of history so the ops dashboard has something to show.
    rng = random.Random(7)
    for days_ago in range(1, 8):
        day = today - timedelta(days=days_ago)
        for u in (maya, jordan, priya):
            for slot in ("12:30", "15:40", "19:10"):
                if rng.random() < 0.55:
                    continue
                t = at(day, slot) + timedelta(minutes=rng.randint(-25, 25))
                h = {"score": rng.randint(u.hunger_threshold, 92), "reason": "Historical demo order"}
                options = loop.recommender.recommend(
                    u, {"ts": t, "energy_deficit_kcal": rng.randint(350, 900), "factors": {}},
                    rests, [], 10_000, limit=3)["options"]
                pick = rng.choice(options)
                o = loop.create_order(db, u, pick["restaurant"], pick["items"], t=t, h=h,
                                      trigger="signal" if rng.random() < 0.8 else "manual")
                roll = rng.random()
                if roll < 0.72:
                    via = "autopilot" if u.mode == "autopilot" else rng.choice(["watch_tap", "watch_tap", "voice", "phone"])
                    loop.confirm(db, o, via, t + timedelta(minutes=rng.randint(0, 4)))
                    o.status = "delivered"
                    o.delivered_at = o.eta + timedelta(minutes=rng.randint(-3, 6))
                else:
                    o.status = "declined" if roll < 0.9 else "expired"
                    o.respond_by = None
    db.commit()


def main():
    db = SessionLocal()
    try:
        seed(db)
        print("Seeded demo data.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
