import { useState, useEffect } from "react";
import { getJobs, createJob } from "./api";

const MODEL_OPTIONS = [
  "LLaMA 3 70B",
  "Mistral 7B",
  "CodeLlama 34B",
  "SDXL",
  "Whisper Large",
  "BGE Large",
];
const PRIORITY_OPTIONS = ["Low", "Normal", "High"];
const SIZE_UNITS = ["tokens", "images", "hours"];

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
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [formError, setFormError] = useState("");

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    const form = e.target;
    const name = form.jobName?.value?.trim();
    const model_type = form.modelType?.value;
    const sizeVal = parseInt(form.sizeValue?.value, 10);
    const unit = form.sizeUnit?.value || "tokens";
    const priority = form.priority?.value || "Normal";

    if (!name || !model_type) {
      setFormError("Name and model are required");
      return;
    }
    let size_tokens_or_images = Number.isFinite(sizeVal) ? sizeVal : 50000;
    if (unit === "images") size_tokens_or_images = size_tokens_or_images;
    if (unit === "hours") size_tokens_or_images = size_tokens_or_images * 1000;

    setFormError("");
    setSubmitLoading(true);
    try {
      await createJob({
        name,
        model_type,
        size_tokens_or_images,
        priority,
      });
      setPanelOpen(false);
      form.reset();
      fetchJobs();
    } catch (err) {
      setFormError(err.message || "Failed to create job");
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    <div className="jobs-view">
      <div className="jobs-header">
        <h1 className="view-title">JOBS</h1>
        <button
          type="button"
          className="btn-primary"
          onClick={() => setPanelOpen(true)}
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

      {panelOpen && (
        <div className="slide-panel-overlay" onClick={() => setPanelOpen(false)}>
          <div
            className="slide-panel"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="slide-panel-header">
              <h2>NEW JOB</h2>
              <button
                type="button"
                className="panel-close"
                onClick={() => setPanelOpen(false)}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleSubmit} className="panel-form">
              <label>
                Job Name
                <input name="jobName" type="text" placeholder="Job name" />
              </label>
              <label>
                Model Type
                <select name="modelType" required>
                  {MODEL_OPTIONS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Size
                <div className="size-input-row">
                  <input
                    name="sizeValue"
                    type="number"
                    min={1}
                    defaultValue={50}
                  />
                  <select name="sizeUnit">
                    {SIZE_UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
              </label>
              <label>
                Priority
                <select name="priority">
                  {PRIORITY_OPTIONS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>
              {formError && <p className="panel-error">{formError}</p>}
              <button type="submit" className="btn-primary" disabled={submitLoading}>
                {submitLoading ? "Submitting…" : "Submit"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
