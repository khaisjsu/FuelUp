"""Simulated CGM and watch signals.

Nothing here talks to a real device. Glucose is a simple, deterministic model of
how meals and exercise move blood sugar: a rise that peaks 40-60 minutes after
eating, then a dip below baseline whose depth depends on how fast the carbs
were. Heart rate, HRV, steps and active calories follow the user's activities.
The same inputs always give the same numbers, so demos are repeatable.
"""

import math
from datetime import datetime

GLYCEMIC_RISE = {"low": 0.45, "medium": 0.75, "high": 1.1}  # mg/dL per gram of carbs
GLYCEMIC_PEAK_MIN = {"low": 60, "medium": 50, "high": 40}
GLYCEMIC_DIP = {"low": 0.06, "medium": 0.15, "high": 0.26}  # share of the rise


def _noise(user_id: int, t: datetime, salt: int) -> float:
    """Deterministic pseudo-random value in [-1, 1] for a user and timestamp."""
    x = math.sin(user_id * 12.9898 + t.timestamp() / 300 * 78.233 + salt * 37.719)
    return (x * 43758.5453) % 2 - 1


def glucose_at(user, t: datetime, meals, activities) -> float:
    g = user.glucose_baseline
    last_meal_min = None
    for m in meals:
        dt = (t - m.ts).total_seconds() / 60
        if dt < 0:
            continue
        last_meal_min = dt if last_meal_min is None else min(last_meal_min, dt)
        if dt > 360:
            continue
        amp = m.carbs_g * GLYCEMIC_RISE.get(m.glycemic, 0.75) * 0.6
        peak = GLYCEMIC_PEAK_MIN.get(m.glycemic, 50)
        rise = amp * (dt / peak) * math.exp(1 - dt / peak)
        dip_center = peak + 150
        dip = amp * GLYCEMIC_DIP.get(m.glycemic, 0.2) * math.exp(-(((dt - dip_center) / 55) ** 2))
        g += rise - dip
    for a in activities:
        if a.start <= t <= a.end:
            mins = (t - a.start).total_seconds() / 60
            g -= min(18, mins * 0.35)
        elif a.end < t:
            since = (t - a.end).total_seconds() / 60
            if since < 90:
                total = (a.end - a.start).total_seconds() / 60
                g -= min(18, total * 0.35) * (1 - since / 90)
    # Slow downward drift after a long fast.
    if last_meal_min is None or last_meal_min > 240:
        fasting = 240 if last_meal_min is None else last_meal_min
        g -= min(8, (fasting - 240) / 30 + 3)
    g += _noise(user.id, t, 1) * 1.4
    return round(g, 1)


def watch_at(user, t: datetime, activities, step_minutes: int = 5) -> dict:
    current = next((a for a in activities if a.start <= t <= a.end), None)
    recent = next(
        (a for a in activities if a.end < t and (t - a.end).total_seconds() < 1800), None
    )
    n = _noise(user.id, t, 2)
    if current:
        hr = current.heart_rate + n * 6
        hrv = 28 + n * 4
        kcal = current.kcal_per_min * step_minutes
        steps = int(650 + n * 120)
    elif recent:
        cool = (t - recent.end).total_seconds() / 1800
        hr = recent.heart_rate - (recent.heart_rate - 72) * cool + n * 4
        hrv = 35 + 15 * cool + n * 4
        kcal = 2.2 * step_minutes
        steps = int(120 + n * 60)
    else:
        hr = 66 + n * 5
        hrv = 52 + n * 7
        kcal = (1.3 + n * 0.3) * step_minutes
        steps = int(max(0, 160 + n * 140))
    return {
        "heart_rate": int(round(hr)),
        "hrv_ms": int(round(hrv)),
        "active_kcal": round(max(0.0, kcal), 1),
        "steps": max(0, steps),
    }
