from .models import MenuItem, Order, Reading, Restaurant, User


def user(u: User) -> dict:
    return {
        "id": u.id,
        "name": u.name,
        "email": u.email,
        "persona": u.persona,
        "avatar_color": u.avatar_color,
        "devices": u.devices,
        "daily_kcal_target": u.daily_kcal_target,
        "protein_target_g": u.protein_target_g,
        "glucose_baseline": u.glucose_baseline,
        "mode": u.mode,
        "hunger_threshold": u.hunger_threshold,
        "weekly_budget_cents": u.weekly_budget_cents,
        "max_orders_per_day": u.max_orders_per_day,
        "cancel_window_min": u.cancel_window_min,
        "allergies": u.allergies,
        "diet": u.diet,
        "delivery_address": u.delivery_address,
        "sim_now": u.sim_now,
    }


def item(i: MenuItem) -> dict:
    return {
        "id": i.id,
        "restaurant_id": i.restaurant_id,
        "name": i.name,
        "description": i.description,
        "price_cents": i.price_cents,
        "kcal": i.kcal,
        "protein_g": i.protein_g,
        "carbs_g": i.carbs_g,
        "fat_g": i.fat_g,
        "fiber_g": i.fiber_g,
        "glycemic": i.glycemic,
        "allergens": i.allergens,
        "tags": i.tags,
    }


def restaurant(r: Restaurant, with_items: bool = False) -> dict:
    out = {
        "id": r.id,
        "name": r.name,
        "cuisine": r.cuisine,
        "rating": r.rating,
        "eta_minutes": r.prep_minutes + r.travel_minutes,
        "delivery_partner": r.delivery_partner,
        "delivery_fee_cents": r.delivery_fee_cents,
        "verified": r.verified,
    }
    if with_items:
        out["items"] = [item(i) for i in r.items]
    return out


def order(o: Order) -> dict:
    return {
        "id": o.id,
        "user_id": o.user_id,
        "restaurant": restaurant(o.restaurant),
        "status": o.status,
        "trigger": o.trigger,
        "confirmed_via": o.confirmed_via,
        "hunger_score": o.hunger_score,
        "reason": o.reason,
        "items": [
            {"name": it.menu_item.name, "quantity": it.quantity, "price_cents": it.price_cents,
             "kcal": it.menu_item.kcal, "protein_g": it.menu_item.protein_g}
            for it in o.items
        ],
        "subtotal_cents": o.subtotal_cents,
        "delivery_fee_cents": o.delivery_fee_cents,
        "total_cents": o.total_cents,
        "kcal": o.kcal,
        "protein_g": o.protein_g,
        "created_at": o.created_at,
        "respond_by": o.respond_by,
        "confirmed_at": o.confirmed_at,
        "eta": o.eta,
        "delivered_at": o.delivered_at,
    }


def reading(r: Reading) -> dict:
    return {
        "ts": r.ts,
        "glucose_mgdl": r.glucose_mgdl,
        "heart_rate": r.heart_rate,
        "hrv_ms": r.hrv_ms,
        "active_kcal": r.active_kcal,
        "steps": r.steps,
    }


def option(o: dict) -> dict:
    return {
        "restaurant": restaurant(o["restaurant"]),
        "items": [item(i) for i in o["items"]],
        "kcal": o["kcal"],
        "protein_g": o["protein_g"],
        "subtotal_cents": o["subtotal_cents"],
        "total_cents": o["total_cents"],
        "glycemic": o["glycemic"],
        "eta_minutes": o["eta_minutes"],
        "why": o["why"],
    }
