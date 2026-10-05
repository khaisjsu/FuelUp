"""Database tables.

Times are naive datetimes on each user's *simulated* clock (users.sim_now). The
prototype has no real sensors, so the simulator moves that clock forward and
writes readings, hunger snapshots and order updates as it goes.
"""

from datetime import datetime, timezone

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(80))
    email: Mapped[str] = mapped_column(String(120), unique=True)
    persona: Mapped[str] = mapped_column(String(160))
    avatar_color: Mapped[str] = mapped_column(String(16), default="#0f766e")
    # Which simulated devices this user "wears": any of "cgm", "watch", "ring".
    devices: Mapped[list] = mapped_column(JSON, default=list)
    weight_kg: Mapped[float] = mapped_column(Float, default=70)
    bmr_kcal_day: Mapped[int] = mapped_column(Integer, default=1600)
    glucose_baseline: Mapped[float] = mapped_column(Float, default=92)
    daily_kcal_target: Mapped[int] = mapped_column(Integer, default=2200)
    protein_target_g: Mapped[int] = mapped_column(Integer, default=110)
    # off: never order. confirm: propose and wait for a tap. autopilot: order
    # unless cancelled within cancel_window_min.
    mode: Mapped[str] = mapped_column(String(16), default="confirm")
    hunger_threshold: Mapped[int] = mapped_column(Integer, default=70)
    weekly_budget_cents: Mapped[int] = mapped_column(Integer, default=12000)
    max_orders_per_day: Mapped[int] = mapped_column(Integer, default=2)
    cancel_window_min: Mapped[int] = mapped_column(Integer, default=5)
    allergies: Mapped[list] = mapped_column(JSON, default=list)
    diet: Mapped[list] = mapped_column(JSON, default=list)
    delivery_address: Mapped[str] = mapped_column(String(200), default="")
    sim_now: Mapped[datetime] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None)
    )


class Restaurant(Base):
    __tablename__ = "restaurants"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    cuisine: Mapped[str] = mapped_column(String(60))
    rating: Mapped[float] = mapped_column(Float, default=4.5)
    prep_minutes: Mapped[int] = mapped_column(Integer, default=12)
    travel_minutes: Mapped[int] = mapped_column(Integer, default=15)
    delivery_partner: Mapped[str] = mapped_column(String(40), default="DoorDash Drive")
    delivery_fee_cents: Mapped[int] = mapped_column(Integer, default=299)
    verified: Mapped[bool] = mapped_column(Boolean, default=True)

    items: Mapped[list["MenuItem"]] = relationship(back_populates="restaurant")


class MenuItem(Base):
    __tablename__ = "menu_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    restaurant_id: Mapped[int] = mapped_column(ForeignKey("restaurants.id"))
    name: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(Text, default="")
    price_cents: Mapped[int] = mapped_column(Integer)
    kcal: Mapped[int] = mapped_column(Integer)
    protein_g: Mapped[int] = mapped_column(Integer)
    carbs_g: Mapped[int] = mapped_column(Integer)
    fat_g: Mapped[int] = mapped_column(Integer)
    fiber_g: Mapped[int] = mapped_column(Integer, default=4)
    glycemic: Mapped[str] = mapped_column(String(8), default="medium")  # low/medium/high
    allergens: Mapped[list] = mapped_column(JSON, default=list)
    tags: Mapped[list] = mapped_column(JSON, default=list)

    restaurant: Mapped[Restaurant] = relationship(back_populates="items")


class Reading(Base):
    """One 5-minute sample from the simulated CGM and watch."""

    __tablename__ = "readings"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    ts: Mapped[datetime] = mapped_column(DateTime, index=True)
    glucose_mgdl: Mapped[float | None] = mapped_column(Float, nullable=True)
    heart_rate: Mapped[int] = mapped_column(Integer)
    hrv_ms: Mapped[int] = mapped_column(Integer)
    active_kcal: Mapped[float] = mapped_column(Float)
    steps: Mapped[int] = mapped_column(Integer)


class Meal(Base):
    """Something the user ate: seeded, logged by hand, or a delivered order."""

    __tablename__ = "meals"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    ts: Mapped[datetime] = mapped_column(DateTime)
    label: Mapped[str] = mapped_column(String(80))
    kcal: Mapped[int] = mapped_column(Integer)
    carbs_g: Mapped[int] = mapped_column(Integer)
    glycemic: Mapped[str] = mapped_column(String(8), default="medium")
    source: Mapped[str] = mapped_column(String(16), default="logged")
    order_id: Mapped[int | None] = mapped_column(ForeignKey("orders.id"), nullable=True)


class Activity(Base):
    __tablename__ = "activities"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    kind: Mapped[str] = mapped_column(String(40))
    start: Mapped[datetime] = mapped_column(DateTime)
    end: Mapped[datetime] = mapped_column(DateTime)
    kcal_per_min: Mapped[float] = mapped_column(Float, default=9)
    heart_rate: Mapped[int] = mapped_column(Integer, default=140)


class HungerSnapshot(Base):
    __tablename__ = "hunger_snapshots"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    ts: Mapped[datetime] = mapped_column(DateTime, index=True)
    score: Mapped[int] = mapped_column(Integer)
    minutes_to_window: Mapped[int | None] = mapped_column(Integer, nullable=True)
    energy_deficit_kcal: Mapped[int] = mapped_column(Integer)
    reason: Mapped[str] = mapped_column(Text)
    factors: Mapped[dict] = mapped_column(JSON)


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    restaurant_id: Mapped[int] = mapped_column(ForeignKey("restaurants.id"))
    # proposed -> confirmed -> preparing -> on_the_way -> delivered
    # or proposed -> declined / expired, or confirmed... -> cancelled
    status: Mapped[str] = mapped_column(String(16), index=True)
    trigger: Mapped[str] = mapped_column(String(16))  # signal / manual
    confirmed_via: Mapped[str | None] = mapped_column(String(16), nullable=True)
    hunger_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    reason: Mapped[str] = mapped_column(Text, default="")
    subtotal_cents: Mapped[int] = mapped_column(Integer)
    delivery_fee_cents: Mapped[int] = mapped_column(Integer)
    total_cents: Mapped[int] = mapped_column(Integer)
    kcal: Mapped[int] = mapped_column(Integer)
    protein_g: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime)
    respond_by: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    eta: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    restaurant: Mapped[Restaurant] = relationship()
    items: Mapped[list["OrderItem"]] = relationship(
        back_populates="order", cascade="all, delete-orphan"
    )


class OrderItem(Base):
    __tablename__ = "order_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id"))
    menu_item_id: Mapped[int] = mapped_column(ForeignKey("menu_items.id"))
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    price_cents: Mapped[int] = mapped_column(Integer)

    order: Mapped[Order] = relationship(back_populates="items")
    menu_item: Mapped[MenuItem] = relationship()
