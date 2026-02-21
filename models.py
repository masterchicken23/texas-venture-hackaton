"""SQLAlchemy models for FleetCompute job persistence."""
from datetime import datetime
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


class Job(db.Model):
    __tablename__ = "jobs"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(128), nullable=False)
    model_type = db.Column(db.String(64), nullable=False)
    size_description = db.Column(db.String(64), nullable=False)  # e.g. "100k tokens"
    status = db.Column(db.String(32), nullable=False, default="pending")  # pending, running, completed
    vehicle_id = db.Column(db.String(32), nullable=True)
    company = db.Column(db.String(64), nullable=False)
    priority = db.Column(db.String(16), nullable=False, default="Normal")  # Low, Normal, High
    estimated_duration_minutes = db.Column(db.Integer, nullable=False)
    cost_usd = db.Column(db.Float, nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "model_type": self.model_type,
            "size_description": self.size_description,
            "status": self.status,
            "vehicle_id": self.vehicle_id,
            "created_at": self.created_at.isoformat() + "Z" if self.created_at else None,
            "estimated_completion": None,  # filled in app layer with computed value
            "progress": None,
            "cost_usd": round(self.cost_usd, 2),
        }
