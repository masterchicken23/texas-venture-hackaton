import { useState, useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker } from "react-leaflet";
import L from "leaflet";
import { getFleetVehicles } from "./api";
import "leaflet/dist/leaflet.css";

const AUSTIN_CENTER = [30.2672, -97.7431];
const CARTO_DARK =
  "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";

function fleetVehicleIcon(fill, pulse) {
  const div = document.createElement("div");
  div.style.cssText = `
    width: 10px; height: 10px; border-radius: 50%;
    background: ${fill}; border: 1px solid rgba(255,255,255,0.5);
    box-shadow: ${pulse ? `0 0 10px ${fill}` : "none"};
  `;
  return L.divIcon({ html: div, iconSize: [10, 10], iconAnchor: [5, 5] });
}

function FleetVehicleMarker({ vehicle }) {
  const fill =
    vehicle.status === "compute_active"
      ? "#00ff88"
      : vehicle.status === "charging"
        ? "#4A9EFF"
        : vehicle.status === "in_service"
          ? "#ffffff"
          : "#6b7280";
  const pulse = vehicle.status === "compute_active" || vehicle.status === "charging";
  const icon = useMemo(() => fleetVehicleIcon(fill, pulse), [fill, pulse]);
  return <Marker position={[vehicle.lat, vehicle.lng]} icon={icon} />;
}

const STATUS_CONFIG = {
  compute_active: { label: "Computing", color: "#00ff88" },
  charging: { label: "Charging", color: "#4A9EFF" },
  in_service: { label: "In Service", color: "#ffffff" },
  idle: { label: "Idle", color: "#6b7280" },
};

export default function FleetView() {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await getFleetVehicles();
        setVehicles(data);
        setError(null);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    const id = setInterval(fetchData, 3000);
    return () => clearInterval(id);
  }, []);

  const statusCounts = useMemo(() => {
    const counts = {};
    for (const v of vehicles) {
      counts[v.status] = (counts[v.status] || 0) + 1;
    }
    return counts;
  }, [vehicles]);

  const byHub = useMemo(() => {
    const map = new Map();
    for (const v of vehicles) {
      const hub = v.hub_id || "Roaming";
      if (!map.has(hub)) map.set(hub, []);
      map.get(hub).push(v);
    }
    return Array.from(map.entries());
  }, [vehicles]);

  return (
    <div className="fleet-view">
      <h1 className="view-title">FLEET STATUS</h1>
      {error && <p className="view-error">{error}</p>}

      {/* Summary bar */}
      <div className="fleet-summary-bar">
        {Object.entries(STATUS_CONFIG).map(([status, cfg]) => (
          <div key={status} className="fleet-summary-item">
            <span className="fleet-summary-dot" style={{ background: cfg.color }} />
            <span className="fleet-summary-count">{statusCounts[status] || 0}</span>
            <span>{cfg.label}</span>
          </div>
        ))}
        <div className="fleet-summary-item">
          <span className="fleet-summary-count" style={{ color: "#e2e8f0" }}>
            {vehicles.length}
          </span>
          <span>Total</span>
        </div>
      </div>

      <div className="fleet-map-wrap">
        <MapContainer
          center={AUSTIN_CENTER}
          zoom={10}
          className="fleet-map"
          zoomControl={true}
        >
          <TileLayer url={CARTO_DARK} />
          {vehicles.map((v) => (
            <FleetVehicleMarker key={v.id} vehicle={v} />
          ))}
        </MapContainer>
      </div>

      <div className="table-wrap fleet-table-wrap">
        {loading ? (
          <p className="view-loading">Loading fleet…</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>COMPANY</th>
                <th>HUB</th>
                <th>STATUS</th>
                <th>LOAD</th>
                <th>CURRENT JOB</th>
              </tr>
            </thead>
            <tbody>
              {byHub.flatMap(([hub, list]) =>
                list.map((v) => (
                  <tr key={v.id}>
                    <td className="cell-mono">{v.id}</td>
                    <td>{v.company}</td>
                    <td className="cell-mono">{hub}</td>
                    <td>
                      <span
                        className={`status-badge status-${(v.status || "").replace(/_/g, "")}`}
                      >
                        {v.status}
                      </span>
                    </td>
                    <td>
                      <div className="progress-bar-wrap">
                        <div
                          className="progress-bar-fill"
                          style={{
                            width: `${(v.compute_load ?? 0) * 100}%`,
                          }}
                        />
                      </div>
                    </td>
                    <td className="cell-mono">
                      {v.current_job_id ?? "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
