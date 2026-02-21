"""ERCOT price simulation and fleet/vehicle simulation for FleetCompute."""
import math
from datetime import datetime, timezone, timedelta

# --- ERCOT price curve (cents/kWh) ---
# midnight-5am: -2 to 8, 6am-9am: 15-35, 10am-4pm: 40-65, 5pm-11pm: 20-35
# Use minute-of-day for deterministic same-minute result


def _ercot_base_price(hour: float, minute: float) -> float:
    """Base price from hour (0-24) and minute. Deterministic."""
    t = hour + minute / 60.0
    if t < 5:
        return -2 + (8 - (-2)) * (t / 5)  # -2 to 8
    if t < 6:
        return 8 + (15 - 8) * (t - 5)
    if t < 9:
        return 15 + (35 - 15) * ((t - 6) / 3)
    if t < 10:
        return 35 + (40 - 35) * (t - 9)
    if t < 16:
        return 40 + (65 - 40) * ((t - 10) / 6)
    if t < 17:
        return 65 + (20 - 65) * (t - 16)
    if t < 23:
        return 20 + (35 - 20) * ((t - 17) / 6)
    # 23-24
    return 35 + (-2 - 35) * (t - 23)


def _gaussian_noise_seed(seed: int) -> float:
    """Deterministic pseudo-gaussian from integer seed (Box-Muller style)."""
    # Simple deterministic "noise" from seed
    x = (seed * 1103515245 + 12345) & 0x7FFFFFFF
    u1 = (x % 10000) / 10000.0
    if u1 <= 0:
        u1 = 0.0001
    u2 = ((seed * 48271) % 10000) / 10000.0
    return math.sqrt(-2 * math.log(u1)) * math.cos(2 * math.pi * u2)


def get_ercot_current(now: datetime | None = None) -> dict:
    """Current ERCOT spot price with small gaussian noise. Deterministic per minute."""
    if now is None:
        now = datetime.now(timezone.utc)
    hour = now.hour + now.minute / 60.0 + now.second / 3600.0
    minute_frac = now.minute + now.second / 60.0
    base = _ercot_base_price(now.hour, minute_frac)
    seed = now.year * 100000000 + now.month * 1000000 + now.day * 10000 + now.hour * 100 + now.minute
    noise = _gaussian_noise_seed(seed) * 1.5
    price = round(base + noise, 2)
    # Trend: compare to 5 minutes ago (conceptually)
    prev_time = now - timedelta(minutes=5)
    seed_prev = prev_time.year * 100000000 + prev_time.month * 1000000 + prev_time.day * 10000 + prev_time.hour * 100 + prev_time.minute
    base_prev = _ercot_base_price(prev_time.hour, prev_time.minute + prev_time.second / 60.0)
    prev_price = base_prev + _gaussian_noise_seed(seed_prev) * 1.5
    if price > prev_price + 0.5:
        trend = "rising"
    elif price < prev_price - 0.5:
        trend = "falling"
    else:
        trend = "stable"
    return {
        "price": price,
        "timestamp": now.isoformat(),
        "trend": trend,
    }


def get_ercot_history(minutes: int = 30, now: datetime | None = None) -> list[dict]:
    """List of { price, timestamp } for last N minutes, one per minute. Deterministic."""
    if now is None:
        now = datetime.now(timezone.utc)
    out = []
    for i in range(minutes, 0, -1):
        t = now - timedelta(minutes=i)
        base = _ercot_base_price(t.hour, t.minute + t.second / 60.0)
        seed = t.year * 100000000 + t.month * 1000000 + t.day * 10000 + t.hour * 100 + t.minute
        noise = _gaussian_noise_seed(seed) * 1.5
        price = round(base + noise, 2)
        out.append({"price": price, "timestamp": t.isoformat()})
    return out


# --- Fleet: 5 hubs (Austin outskirts) ---
HUBS = [
    {"id": "hub_0", "name": "Austin Airport area", "lat": 30.1975, "lng": -97.6664},
    {"id": "hub_1", "name": "Round Rock", "lat": 30.5083, "lng": -97.6789},
    {"id": "hub_2", "name": "Cedar Park", "lat": 30.5052, "lng": -97.8203},
    {"id": "hub_3", "name": "South Austin/Slaughter", "lat": 30.1688, "lng": -97.7831},
    {"id": "hub_4", "name": "East Austin/183", "lat": 30.3072, "lng": -97.6603},
]

# 30 vehicles: 4-6 per hub at hub (charging or compute_active), rest idle/in_service with drift
HUB_VEHICLE_COUNTS = [5, 6, 5, 5, 4]  # sum = 25 at hubs; 5 roaming
assert sum(HUB_VEHICLE_COUNTS) == 25


def _drift_offset(vehicle_index: int, now: datetime) -> tuple[float, float]:
    """Time-based sine offsets so positions drift ~25mph. Same result for same minute."""
    # ~25 mph ≈ 0.007 deg/min rough ballpark for lat (1 deg ~ 69 miles)
    t = now.hour * 60 + now.minute + now.second / 60.0
    phase = vehicle_index * 0.7
    dlat = 0.004 * math.sin(t * 0.02 + phase) + 0.003 * math.sin(t * 0.03 + phase * 1.3)
    dlng = 0.004 * math.cos(t * 0.025 + phase * 0.9) + 0.003 * math.cos(t * 0.035 + phase * 1.1)
    return (dlat, dlng)


def get_fleet_vehicles(now: datetime | None = None) -> list[dict]:
    """30 simulated vehicles. Hub vehicles charging/compute_active; rest idle/in_service with drift."""
    if now is None:
        now = datetime.now(timezone.utc)
    vehicles = []
    vid = 0
    for hub_idx, hub in enumerate(HUBS):
        n = HUB_VEHICLE_COUNTS[hub_idx]
        for i in range(n):
            # Alternate charging vs compute_active per vehicle for variety
            status = "compute_active" if (vid + hub_idx) % 2 == 0 else "charging"
            vehicles.append({
                "id": f"vehicle_{vid}",
                "status": status,
                "lat": round(hub["lat"], 4),
                "lng": round(hub["lng"], 4),
                "hub_id": hub["id"],
                "company": "Waymo" if vid % 3 == 0 else ("Zoox" if vid % 3 == 1 else "FleetCompute"),
                "compute_load": 0.7 + (vid % 30) * 0.01 if status == "compute_active" else 0,
                "current_job_id": str(vid * 11 % 100) if status == "compute_active" else None,
            })
            vid += 1
    # 5 roaming vehicles: idle or in_service, drift
    base_lat, base_lng = 30.27, -97.74  # Austin area center
    for i in range(5):
        dlat, dlng = _drift_offset(25 + i, now)
        status = "in_service" if i % 2 == 0 else "idle"
        vehicles.append({
            "id": f"vehicle_{vid}",
            "status": status,
            "lat": round(base_lat + dlat, 4),
            "lng": round(base_lng + dlng, 4),
            "hub_id": None,
            "company": "Waymo" if vid % 3 == 0 else ("Zoox" if vid % 3 == 1 else "FleetCompute"),
            "compute_load": 0,
            "current_job_id": None,
        })
        vid += 1
    return vehicles


def get_economics_summary(now: datetime | None = None) -> dict:
    """Realistic numbers that increment by time of day."""
    if now is None:
        now = datetime.now(timezone.utc)
    hour = now.hour + now.minute / 60.0
    # Rush-ish hours more ride revenue
    ride_factor = 0.5 + 0.5 * math.sin((hour - 7) * math.pi / 6)
    ride_revenue = round(12000 + 8000 * max(0, ride_factor) + (now.minute * 2), 2)
    compute_revenue = round(25000 + (hour - 8) * 500 + now.minute * 3, 2)
    grid_arbitrage = round(1200 + 400 * math.sin(hour * 0.4) + now.minute, 2)
    jobs_per_hour = max(5, int(12 + 8 * math.sin((hour - 10) * 0.3)))
    active_vehicles = 22 + (now.minute % 5)
    total_fleet = 30
    return {
        "ride_revenue": ride_revenue,
        "compute_revenue": compute_revenue,
        "grid_arbitrage": grid_arbitrage,
        "jobs_per_hour": jobs_per_hour,
        "active_vehicles": min(active_vehicles, total_fleet),
        "total_fleet": total_fleet,
    }
