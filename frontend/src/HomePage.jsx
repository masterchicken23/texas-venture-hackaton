import { useState, useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import { getErcotCurrent, getFleetVehicles, login } from "./api";
import "leaflet/dist/leaflet.css";

const AUSTIN_CENTER = [30.2672, -97.7431];
const CARTO_DARK =
  "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";

const PARTNERS = [
  { name: "Waymo", accent: "#4A9EFF" },
  { name: "Zoox", accent: "#FF6B2B" },
  { name: "AVride", accent: "#A855F7" },
  { name: "Volkswagen Moia", accent: "#00C9A7" },
];

const HOW_IT_WORKS = [
  { icon: "🅿️", title: "Park", desc: "AVs dock at charging hubs" },
  { icon: "⚡", title: "Connect", desc: "Join the compute mesh" },
  { icon: "🧠", title: "Compute", desc: "Run AI workloads at 68% less cost" },
];

function vehicleIcon(fill, pulse) {
  const div = document.createElement("div");
  div.className = `home-vehicle-dot ${pulse ? "pulse" : ""}`;
  div.style.cssText = `
    width: 12px; height: 12px; border-radius: 50%;
    background: ${fill}; border: 2px solid rgba(255,255,255,0.6);
    box-shadow: ${pulse ? `0 0 16px ${fill}, 0 0 32px ${fill}` : "0 1px 4px rgba(0,0,0,0.4)"};
  `;
  return L.divIcon({ html: div, iconSize: [12, 12], iconAnchor: [6, 6] });
}

function VehicleMarker({ vehicle }) {
  const isHub =
    vehicle.status === "compute_active" || vehicle.status === "charging";
  const baseLat = vehicle.lat;
  const baseLng = vehicle.lng;
  const [pos, setPos] = useState([baseLat, baseLng]);

  useEffect(() => {
    if (isHub) {
      setPos([baseLat, baseLng]);
      return;
    }
    const vid = parseInt(vehicle.id.replace("vehicle_", ""), 10) || 0;
    const phase = vid * 0.7;
    const interval = setInterval(() => {
      const t = Date.now() * 0.001;
      setPos([
        baseLat + 0.004 * Math.sin(t * 0.02 + phase) + 0.003 * Math.sin(t * 0.03 + phase * 1.3),
        baseLng + 0.004 * Math.cos(t * 0.025 + phase * 0.9) + 0.003 * Math.cos(t * 0.035 + phase * 1.1),
      ]);
    }, 150);
    return () => clearInterval(interval);
  }, [isHub, baseLat, baseLng, vehicle.id]);

  const fill =
    vehicle.status === "compute_active"
      ? "#00ff88"
      : vehicle.status === "charging"
        ? "#4A9EFF"
        : vehicle.status === "in_service"
          ? "#ffffff"
          : "#6b7280";

  const icon = useMemo(() => vehicleIcon(fill, isHub), [fill, isHub]);
  return <Marker position={pos} icon={icon} />;
}

function VehicleLayer({ vehicles }) {
  if (!vehicles?.length) return null;
  return (
    <>
      {vehicles.map((v) => (
        <VehicleMarker key={v.id} vehicle={v} />
      ))}
    </>
  );
}

function MapContent({ vehicles }) {
  return <VehicleLayer vehicles={vehicles} />;
}

function useCountUp(target, duration = 1500) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
      setValue(Math.round(target * eased));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target, duration]);
  return value;
}

function TrendArrow({ trend }) {
  if (!trend) return null;
  const arrow = trend === "rising" ? "↑" : trend === "falling" ? "↓" : "→";
  return <span className={`trend-indicator trend-${trend}`}>{arrow}</span>;
}

export default function HomePage({ onLogin }) {
  const [showLogin, setShowLogin] = useState(true);
  const [vehicles, setVehicles] = useState([]);
  const [ercot, setErcot] = useState(null);
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      try {
        const [v, e] = await Promise.all([
          getFleetVehicles(),
          getErcotCurrent(),
        ]);
        if (!cancelled) {
          setVehicles(v);
          setErcot(e);
        }
      } catch (_) { }
    };
    fetchData();
    const id = setInterval(fetchData, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const activeNodes = useMemo(
    () => vehicles.filter((v) => v.status === "compute_active").length,
    [vehicles]
  );

  const computeHours = useCountUp(1840);
  const costSavings = useCountUp(68);
  const co2Saved = useCountUp(7);

  const handleLogin = async (e) => {
    e.preventDefault();
    const form = e.target;
    const username = form.username?.value?.trim();
    const password = form.password?.value;
    const accountType = form.accountType?.value || "user";

    setLoginError("");
    setLoginLoading(true);

    try {
      const data = await login(username, password);
      const roleHint = accountType === "enterprise" ? "admin" : "operator/developer";

      // Keep selector meaningful without blocking access if backend role differs.
      if (accountType === "enterprise" && data.role !== "admin") {
        setLoginError(`Signed in, but this account is not enterprise (${roleHint}).`);
      }

      onLogin({
        token: data.token,
        company: data.company,
        role: data.role,
        username: data.username,
      });
      setShowLogin(false);
    } catch (err) {
      setLoginError(err.message || "Login failed");
    } finally {
      setLoginLoading(false);
    }
  };

  return (
    <div className="home-page">
      <div className="home-map-wrap">
        <MapContainer
          center={AUSTIN_CENTER}
          zoom={10}
          className="home-map"
          zoomControl={false}
        >
          <TileLayer url={CARTO_DARK} />
          <MapContent vehicles={vehicles} />
        </MapContainer>
      </div>

      <header className="home-header">
        <div className="home-brand">
          <span className="home-wordmark">FleetCompute</span>
          <span className="home-tagline">Your car, your compute</span>
        </div>
        <div className="home-partners">
          {PARTNERS.map((p) => (
            <span
              key={p.name}
              className="partner-badge"
              style={{ "--accent": p.accent }}
            >
              {p.name}
            </span>
          ))}
        </div>
        <button
          type="button"
          className="home-signin"
          onClick={() => setShowLogin(true)}
        >
          Sign In
        </button>
      </header>

      {/* Hero overlay */}
      <div className="home-hero">
        <h1 className="hero-headline">
          Turn Idle AVs Into Distributed Compute Nodes
        </h1>
        <p className="hero-sub">
          Autonomous vehicles park, plug in, and run AI workloads — powered by ERCOT grid arbitrage
        </p>
        <div className="hero-stats">
          <div className="hero-stat">
            <span className="hero-stat-value">{computeHours.toLocaleString()}</span>
            <span className="hero-stat-label">Compute Hours</span>
          </div>
          <div className="hero-stat">
            <span className="hero-stat-value">{costSavings}%</span>
            <span className="hero-stat-label">Cost Savings</span>
          </div>
          <div className="hero-stat">
            <span className="hero-stat-value">{co2Saved}t</span>
            <span className="hero-stat-label">CO₂ Offset</span>
          </div>
        </div>
      </div>

      {/* How it works */}
      <div className="home-how-it-works">
        {HOW_IT_WORKS.map((step) => (
          <div key={step.title} className="how-step">
            <div className="how-step-icon">{step.icon}</div>
            <div className="how-step-title">{step.title}</div>
            <div className="how-step-desc">{step.desc}</div>
          </div>
        ))}
      </div>

      <div className="home-bottom-card">
        <div className="home-card-row">
          <span className="home-card-label">ERCOT</span>
          <span className="home-card-value">
            {ercot != null ? (
              <>
                ${ercot.price}/MWh
                <TrendArrow trend={ercot.trend} />
              </>
            ) : "—"}
          </span>
        </div>
        <div className="home-card-row">
          <span className="home-card-label">Active nodes</span>
          <span className="home-card-value">{activeNodes}</span>
        </div>
      </div>

      {showLogin && (
        <div className="modal-overlay">
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title">Sign In</h2>
            <form onSubmit={handleLogin}>
              <input
                name="username"
                type="text"
                placeholder="Username"
                autoComplete="username"
                required
              />
              <input
                name="password"
                type="password"
                placeholder="Password"
                autoComplete="current-password"
                required
              />
              <label className="modal-select-label">
                Account type
                <select name="accountType" defaultValue="user">
                  <option value="user">User</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </label>
              {loginError && <p className="modal-error">{loginError}</p>}
              <button type="submit" disabled={loginLoading}>
                {loginLoading ? "Signing in…" : "Sign In"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
