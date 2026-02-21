import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getJobs } from "./api";

function formatEta(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "—";
  }
}

export default function JobsView() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchJobs = async () => {
    try {
      const data = await getJobs();
      setJobs(data);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
    const id = setInterval(fetchJobs, 10000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="jobs-view">
      <div className="jobs-header">
        <h1 className="view-title">JOBS</h1>
        <button
          type="button"
          className="btn-primary"
          onClick={() => navigate("/dashboard/quote")}
        >
          NEW JOB
        </button>
      </div>

      {error && <p className="view-error">{error}</p>}
      {loading ? (
        <p className="view-loading">Loading jobs…</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>NAME</th>
                <th>MODEL</th>
                <th>SIZE</th>
                <th>STATUS</th>
                <th>PROGRESS</th>
                <th>VEHICLE</th>
                <th>COST</th>
                <th>ETA</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id}>
                  <td className="cell-name">{job.name}</td>
                  <td>{job.model_type}</td>
                  <td>{job.size_description}</td>
                  <td>
                    <span
                      className={`status-badge status-${(job.status || "").toLowerCase()}`}
                    >
                      {job.status}
                    </span>
                  </td>
                  <td>
                    <div className="progress-bar-wrap">
                      <div
                        className="progress-bar-fill"
                        style={{ width: `${job.progress ?? 0}%` }}
                      />
                    </div>
                    <span className="progress-text">{job.progress ?? 0}%</span>
                  </td>
                  <td className="cell-mono">{job.vehicle_id || "—"}</td>
                  <td className="cell-mono cell-green">${job.cost_usd}</td>
                  <td className="cell-mono">
                    {formatEta(job.estimated_completion)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
