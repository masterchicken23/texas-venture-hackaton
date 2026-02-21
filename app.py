"""FleetCompute Flask backend."""
import os
from datetime import datetime, timezone, timedelta
from functools import wraps

import jwt
from flask import Flask, request, jsonify
from flask_cors import CORS

from models import db, Job
from simulator import (
    get_ercot_current,
    get_ercot_history,
    get_fleet_vehicles,
    get_economics_summary,
)

app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get("DATABASE_URI", "sqlite:///fleetcompute.db")
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["JWT_SECRET"] = "fleetcompute-secret"

db.init_app(app)
CORS(app, origins=["http://localhost:3000", "http://localhost:5173"])

USERS = {
    "waymo_ops": {"password": "demo", "company": "Waymo", "role": "operator"},
    "zoox_dev": {"password": "demo", "company": "Zoox", "role": "developer"},
    "admin": {"password": "demo", "company": "FleetCompute", "role": "admin"},
}

PRIORITY_DURATION_MINUTES = {"Low": 240, "Normal": 120, "High": 45}


def _encode_token(username: str, company: str, role: str) -> str:
    payload = {
        "sub": username,
        "company": company,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=24),
    }
    return jwt.encode(payload, app.config["JWT_SECRET"], algorithm="HS256")


def _decode_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, app.config["JWT_SECRET"], algorithms=["HS256"])
    except Exception:
        return None


def require_auth(f):
    @wraps(f)
    def wrapped(*args, **kwargs):
        auth = request.headers.get("Authorization")
        if not auth or not auth.startswith("Bearer "):
            return jsonify({"error": "Missing or invalid Authorization header"}), 401
        token = auth[7:]
        payload = _decode_token(token)
        if not payload:
            return jsonify({"error": "Invalid or expired token"}), 401
        request.auth_payload = payload
        return f(*args, **kwargs)
    return wrapped


def _job_with_progress(job: Job) -> dict:
    d = job.to_dict()
    now = datetime.now(timezone.utc)
    created = job.created_at
    if created.tzinfo is None:
        created = created.replace(tzinfo=timezone.utc)
    duration_min = job.estimated_duration_minutes
    duration_delta = timedelta(minutes=duration_min)
    estimated_completion = created + duration_delta
    d["estimated_completion"] = estimated_completion.isoformat().replace("+00:00", "Z")
    if job.status == "completed":
        d["progress"] = 100
    else:
        elapsed = (now - created).total_seconds()
        total_sec = duration_min * 60
        p = (elapsed / total_sec) * 100 if total_sec else 0
        d["progress"] = min(99, round(p, 1))
    return d


def _cost_usd(size_tokens_or_images: int, priority: str) -> float:
    base = 2.0 + (size_tokens_or_images / 50_000) * 1.5
    mult = {"Low": 0.8, "Normal": 1.0, "High": 1.4}.get(priority, 1.0)
    return round(base * mult, 2)


def _seed_demo_jobs_if_empty():
    if db.session.query(Job).count() > 0:
        return
    companies = ["Waymo", "Zoox", "FleetCompute"]
    demos = [
        ("Lidar calibration batch", "PointCloud", "200k points", "Normal"),
        ("Route optimization", "Transformer", "50k tokens", "High"),
        ("Night vision model", "CNN", "10k images", "Low"),
        ("Trajectory prediction", "LSTM", "80k tokens", "Normal"),
        ("Object detection fine-tune", "YOLO", "5k images", "High"),
    ]
    for company in companies:
        for name, model_type, size_desc, priority in demos:
            size_val = 50000
            if "k tokens" in size_desc:
                size_val = int(size_desc.split("k")[0]) * 1000
            elif "k images" in size_desc or "k points" in size_desc:
                size_val = int(size_desc.split("k")[0]) * 1000
            dur = PRIORITY_DURATION_MINUTES[priority]
            cost = _cost_usd(size_val, priority)
            # Assign to a fake vehicle for demo
            vehicle_id = f"vehicle_{(hash(company) % 25)}"
            job = Job(
                name=name,
                model_type=model_type,
                size_description=size_desc,
                status="running",
                vehicle_id=vehicle_id,
                company=company,
                priority=priority,
                estimated_duration_minutes=dur,
                cost_usd=cost,
            )
            db.session.add(job)
    db.session.commit()


# --- Routes ---


@app.route("/auth/login", methods=["POST"])
def login():
    data = request.get_json() or {}
    username = data.get("username") or data.get("user")
    password = data.get("password")
    if not username or not password:
        return jsonify({"error": "username and password required"}), 400
    user = USERS.get(username)
    if not user or user["password"] != password:
        return jsonify({"error": "Invalid credentials"}), 401
    token = _encode_token(username, user["company"], user["role"])
    if isinstance(token, bytes):
        token = token.decode("utf-8")
    return jsonify({
        "token": token,
        "company": user["company"],
        "role": user["role"],
        "username": username,
    })


@app.route("/ercot/current", methods=["GET"])
def ercot_current():
    return jsonify(get_ercot_current())


@app.route("/ercot/history", methods=["GET"])
def ercot_history():
    minutes = request.args.get("minutes", 30, type=int)
    minutes = max(1, min(120, minutes))
    return jsonify(get_ercot_history(minutes=minutes))


@app.route("/fleet/vehicles", methods=["GET"])
def fleet_vehicles():
    return jsonify(get_fleet_vehicles())


@app.route("/jobs", methods=["GET"])
@require_auth
def list_jobs():
    _seed_demo_jobs_if_empty()
    company = request.auth_payload.get("company")
    role = request.auth_payload.get("role")
    if role == "admin":
        jobs = Job.query.order_by(Job.created_at.desc()).all()
    else:
        jobs = Job.query.filter_by(company=company).order_by(Job.created_at.desc()).all()
    return jsonify([_job_with_progress(j) for j in jobs])


@app.route("/jobs", methods=["POST"])
@require_auth
def create_job():
    _seed_demo_jobs_if_empty()
    data = request.get_json() or {}
    name = data.get("name")
    model_type = data.get("model_type")
    size_tokens_or_images = data.get("size_tokens_or_images", 50000)
    priority = data.get("priority", "Normal")
    if not name or not model_type:
        return jsonify({"error": "name and model_type required"}), 400
    if priority not in PRIORITY_DURATION_MINUTES:
        priority = "Normal"
    company = request.auth_payload.get("company")
    duration_min = PRIORITY_DURATION_MINUTES[priority]
    size_desc = f"{size_tokens_or_images // 1000}k tokens" if size_tokens_or_images >= 1000 else f"{size_tokens_or_images} tokens"
    cost = _cost_usd(size_tokens_or_images, priority)
    # Assign to a random compute_active vehicle (from simulator we have vehicle_0..vehicle_24 at hubs, some compute_active)
    vehicle_id = f"vehicle_{(hash(name + str(datetime.now(timezone.utc).timestamp())) % 25)}"
    job = Job(
        name=name,
        model_type=model_type,
        size_description=size_desc,
        status="running",
        vehicle_id=vehicle_id,
        company=company,
        priority=priority,
        estimated_duration_minutes=duration_min,
        cost_usd=cost,
    )
    db.session.add(job)
    db.session.commit()
    return jsonify(_job_with_progress(job)), 201


@app.route("/jobs/<int:job_id>", methods=["GET"])
@require_auth
def get_job(job_id):
    job = db.session.get(Job, job_id)
    if not job:
        return jsonify({"error": "Job not found"}), 404
    company = request.auth_payload.get("company")
    role = request.auth_payload.get("role")
    if role != "admin" and job.company != company:
        return jsonify({"error": "Job not found"}), 404
    return jsonify(_job_with_progress(job))


@app.route("/economics/summary", methods=["GET"])
def economics_summary():
    return jsonify(get_economics_summary())


with app.app_context():
    db.create_all()


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=True)
