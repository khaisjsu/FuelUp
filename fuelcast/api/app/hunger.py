"""Hunger score: fuse several weak signals into one 0-100 number with a reason.

No device measures hunger directly, so this combines the proxies the research
doc ranked: time since the last meal (scaled by how big it was), the glucose
trend and level against the user's baseline, calories burned since eating, and
low HRV as a small stress nudge. Users without a CGM get the same model with
the glucose term removed and the other weights scaled up.

This is a hand-tuned heuristic standing in for the per-user model the real
product would learn.
"""

from datetime import datetime


def clamp(x: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, x))


def _slope(points: list[tuple[float, float]]) -> float:
    """Least-squares slope of (minutes, value) points."""
    if len(points) < 2:
        return 0.0
    n = len(points)
    mx = sum(p[0] for p in points) / n
    my = sum(p[1] for p in points) / n
    den = sum((p[0] - mx) ** 2 for p in points)
    if den == 0:
        return 0.0
    return sum((p[0] - mx) * (p[1] - my) for p in points) / den


def _fmt_minutes(mins: float) -> str:
    h, m = divmod(int(mins), 60)
    return f"{h}h {m:02d}m" if h else f"{m}m"


def compute(user, t: datetime, readings, meals, previous_score: int | None = None,
            activities=()) -> dict:
    """readings: this user's readings up to t (any order); meals: meals up to t."""
    has_cgm = "cgm" in (user.devices or [])
    past_meals = sorted((m for m in meals if m.ts <= t), key=lambda m: m.ts)
    last_meal = past_meals[-1] if past_meals else None
    mins_since = (t - last_meal.ts).total_seconds() / 60 if last_meal else 600
    last_kcal = last_meal.kcal if last_meal else 0

    # 1. Time since eating, pushed out by bigger meals.
    satiety_min = 75 + last_kcal / 700 * 60
    f_time = clamp((mins_since - satiety_min) / 120)

    # 2. Calories burned since that meal (resting burn plus watch active calories).
    since = last_meal.ts if last_meal else t.replace(hour=0, minute=0)
    active = sum(r.active_kcal for r in readings if since < r.ts <= t)
    burned = user.bmr_kcal_day / 1440 * mins_since + active
    f_energy = clamp((burned - 200) / 350)

    # 3. Glucose trend over the last 30 minutes, and level against baseline.
    recent = sorted(
        (r for r in readings if r.glucose_mgdl is not None and 0 <= (t - r.ts).total_seconds() <= 1800),
        key=lambda r: r.ts,
    )
    glucose = recent[-1].glucose_mgdl if recent else None
    slope = _slope([((r.ts - t).total_seconds() / 60, r.glucose_mgdl) for r in recent])
    f_glucose = 0.0
    if has_cgm and glucose is not None:
        f_glucose = clamp(0.6 * clamp(-slope / 0.6) + 0.7 * clamp((user.glucose_baseline - glucose) / 12))

    # 4. Low HRV (stress or poor recovery) nudges appetite up a little.
    latest = max(readings, key=lambda r: r.ts) if readings else None
    hrv = latest.hrv_ms if latest else 50
    f_stress = clamp((48 - hrv) / 20)

    if has_cgm:
        weights = {"time": 0.30, "glucose": 0.40, "energy": 0.30, "stress": 0.08}
    else:
        weights = {"time": 0.55, "glucose": 0.0, "energy": 0.45, "stress": 0.08}
    raw = (
        weights["time"] * f_time
        + weights["glucose"] * f_glucose
        + weights["energy"] * f_energy
        + weights["stress"] * f_stress
    )
    # Glucose still climbing means the last meal is still landing.
    if has_cgm and slope > 0.5:
        raw *= 0.6
    # Exercise blunts appetite while it lasts; the hunger lands right after.
    exercising = any(a.start <= t < a.end for a in activities)
    if exercising:
        raw *= 0.5
    score = int(round(100 * clamp(raw)))

    minutes_to_window = None
    if score >= user.hunger_threshold:
        minutes_to_window = 0
    elif previous_score is not None and score > previous_score:
        rate = (score - previous_score) / 30  # previous_score is from 30 min ago
        minutes_to_window = int(min(240, (user.hunger_threshold - score) / rate))

    parts: list[tuple[float, str]] = []
    if has_cgm and glucose is not None:
        if slope < -0.15:
            parts.append((f_glucose * weights["glucose"], f"glucose falling ({slope:+.1f} mg/dL per min)"))
        elif glucose < user.glucose_baseline - 4:
            parts.append((f_glucose * weights["glucose"], f"glucose {glucose:.0f} mg/dL, below your usual {user.glucose_baseline:.0f}"))
    meal_name = last_meal.label.lower() if last_meal else "your last meal"
    parts.append((f_time * weights["time"], f"{_fmt_minutes(mins_since)} since {meal_name}"))
    parts.append((f_energy * weights["energy"], f"about {int(burned)} kcal burned since then"))
    if exercising:
        parts.append((1.0, "mid-workout, holding off until you finish"))
    if f_stress > 0.3:
        parts.append((f_stress * weights["stress"], f"low HRV ({hrv} ms)"))
    parts.sort(key=lambda p: -p[0])
    reason = ", ".join(p[1] for p in parts[:3])
    reason = reason[0].upper() + reason[1:]

    return {
        "ts": t,
        "score": score,
        "minutes_to_window": minutes_to_window,
        "energy_deficit_kcal": int(burned),
        "reason": reason,
        "factors": {
            "time_since_meal": round(f_time, 2),
            "glucose": round(f_glucose, 2),
            "energy": round(f_energy, 2),
            "stress": round(f_stress, 2),
            "weights": weights,
            "minutes_since_meal": int(mins_since),
            "glucose_mgdl": glucose,
            "glucose_slope": round(slope, 2),
            "hrv_ms": hrv,
            "has_cgm": has_cgm,
            "exercising": exercising,
        },
    }
