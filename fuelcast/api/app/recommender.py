"""Pick meals that fit the moment: calories needed, protein after training,
slow carbs when glucose is dipping, and the user's hard limits (allergies, diet,
budget). Options are one main, optionally with one side from the same kitchen.
"""

from datetime import timedelta

GLYCEMIC_PENALTY = {"low": 0.0, "medium": 0.3, "high": 0.9}
DIET_OK = {"vegetarian": {"vegetarian", "vegan"}, "vegan": {"vegan"}}


def _allowed(item, user) -> bool:
    if set(item.allergens or []) & set(user.allergies or []):
        return False
    for d in user.diet or []:
        if not set(item.tags or []) & DIET_OK.get(d, {d}):
            return False
    return True


def target_kcal(deficit_kcal: int) -> int:
    return int(max(450, min(900, 300 + deficit_kcal * 0.45)))


def recommend(user, hunger: dict, restaurants, activities, budget_left_cents: int, limit: int = 3):
    t = hunger["ts"]
    kcal_goal = target_kcal(hunger["energy_deficit_kcal"])
    trained = any(a.end <= t and t - a.end < timedelta(hours=3) for a in activities)
    protein_goal = 40 if trained else 28
    glucose_dipping = hunger["factors"].get("glucose_slope", 0) < -0.15

    options = []
    for r in restaurants:
        if not r.verified:
            continue
        items = [i for i in r.items if _allowed(i, user)]
        mains = [i for i in items if "side" not in (i.tags or [])]
        sides = [i for i in items if "side" in (i.tags or [])]
        for main in mains:
            for side in [None, *sides]:
                combo = [main] + ([side] if side else [])
                kcal = sum(i.kcal for i in combo)
                protein = sum(i.protein_g for i in combo)
                subtotal = sum(i.price_cents for i in combo)
                total = subtotal + r.delivery_fee_cents
                if total > budget_left_cents:
                    continue
                gly = max(combo, key=lambda i: GLYCEMIC_PENALTY[i.glycemic]).glycemic
                fit = (
                    -abs(kcal - kcal_goal) / kcal_goal * 2.2
                    + min(protein / protein_goal, 1.2) * (1.4 if trained else 0.8)
                    - GLYCEMIC_PENALTY[gly] * (1.6 if glucose_dipping else 0.8)
                    - total / 2500 * 0.4
                    + (r.rating - 4) * 0.4
                    - (r.prep_minutes + r.travel_minutes) / 60 * 0.5
                )
                why = [f"{kcal} kcal for a ~{kcal_goal} kcal gap", f"{protein} g protein"]
                if trained:
                    why.append("protein-forward after your workout")
                if gly == "low":
                    why.append("slow carbs to avoid another crash" if glucose_dipping else "slow carbs")
                options.append(
                    {
                        "restaurant": r,
                        "items": combo,
                        "kcal": kcal,
                        "protein_g": protein,
                        "subtotal_cents": subtotal,
                        "total_cents": total,
                        "glycemic": gly,
                        "eta_minutes": r.prep_minutes + r.travel_minutes,
                        "fit": round(fit, 3),
                        "why": ", ".join(why),
                    }
                )
    options.sort(key=lambda o: -o["fit"])
    # One option per restaurant so the choices feel different.
    picked, seen = [], set()
    for o in options:
        if o["restaurant"].id in seen:
            continue
        seen.add(o["restaurant"].id)
        picked.append(o)
        if len(picked) == limit:
            break
    return {"kcal_goal": kcal_goal, "protein_goal": protein_goal, "options": picked}
