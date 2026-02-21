import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

function getDateOptions(days = 14) {
  const out = [];
  const now = new Date();
  for (let i = 0; i < days; i += 1) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    out.push({
      value: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
    });
  }
  return out;
}

function getTimeOptions(stepMinutes = 30) {
  const out = [];
  for (let minutes = 0; minutes < 24 * 60; minutes += stepMinutes) {
    const h24 = Math.floor(minutes / 60);
    const mins = minutes % 60;
    const period = h24 >= 12 ? "PM" : "AM";
    const h12 = h24 % 12 || 12;
    const label = `${h12}:${String(mins).padStart(2, "0")} ${period}`;
    out.push({ value: label, label });
  }
  return out;
}

function randomQuote() {
  const amount = 120 + Math.floor(Math.random() * 281);
  return amount;
}

export default function QuotePage() {
  const navigate = useNavigate();
  const dateOptions = useMemo(() => getDateOptions(21), []);
  const timeOptions = useMemo(() => getTimeOptions(30), []);

  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedDate, setSelectedDate] = useState(dateOptions[0]?.value ?? "");
  const [selectedTime, setSelectedTime] = useState("4:30 PM");
  const [quoteAmount, setQuoteAmount] = useState(null);
  const [statusMessage, setStatusMessage] = useState("");

  const filePercent = selectedFile ? 100 : 0;
  const canGenerate = Boolean(selectedFile && selectedDate && selectedTime);
  const canSchedule = Boolean(quoteAmount !== null && canGenerate);

  const handleFiles = (files) => {
    const file = files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setQuoteAmount(null);
    setStatusMessage("");
  };

  const onDrop = (event) => {
    event.preventDefault();
    setDragActive(false);
    handleFiles(event.dataTransfer.files);
  };

  const onBrowseChange = (event) => {
    handleFiles(event.target.files);
  };

  const handleGenerateQuote = () => {
    if (!canGenerate) return;
    const amount = randomQuote();
    setQuoteAmount(amount);
    setStatusMessage("Quote generated. You can now schedule this job.");
  };

  const handleSchedule = () => {
    if (!canSchedule) return;
    const dateLabel = dateOptions.find((d) => d.value === selectedDate)?.label ?? selectedDate;
    setStatusMessage(`Scheduled for ${dateLabel} at ${selectedTime}.`);
    setTimeout(() => {
      navigate("/dashboard");
    }, 900);
  };

  return (
    <div className="quote-page">
      <div className="quote-topbar">
        <div className="quote-logo">QuickQuote</div>
        <button type="button" className="quote-back" onClick={() => navigate("/dashboard")}>
          Back to Jobs
        </button>
      </div>

      <div className="quote-grid">
        <section className="quote-upload-col">
          <h2>UPLOAD YOUR FILE</h2>
          <label
            className={`upload-dropzone ${dragActive ? "is-dragging" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={onDrop}
          >
            <input type="file" className="upload-input" onChange={onBrowseChange} />
            <div className="upload-icon">⇪</div>
            <p className="upload-title">Drag and drop File</p>
            <div className="upload-progress-wrap">
              <div className="upload-progress-fill" style={{ width: `${filePercent}%` }} />
            </div>
            <div className="upload-meta">
              <span className="upload-file-name">
                {selectedFile ? `${selectedFile.name} (${filePercent}%)` : "No file selected"}
              </span>
              <span className="upload-browse">Browse</span>
            </div>
          </label>
        </section>

        <div className="quote-plus">+</div>

        <section className="quote-time-col">
          <h2>When do you need it by?</h2>

          <div className="quote-select-stack">
            <label className="quote-select-label">
              <span>Date</span>
              <select value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}>
                {dateOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="quote-select-label">
              <span>Time</span>
              <select value={selectedTime} onChange={(e) => setSelectedTime(e.target.value)}>
                {timeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <button
            type="button"
            className="quote-generate-btn"
            disabled={!canGenerate}
            onClick={handleGenerateQuote}
          >
            Generate Quote
          </button>
        </section>

        <section className="quote-result-col">
          <p className="quote-result-label">Your Quote</p>
          <p className="quote-result-value">
            {quoteAmount !== null ? `US$ ${quoteAmount}` : "US$ —"}
          </p>
          <button
            type="button"
            className="quote-schedule-btn"
            disabled={!canSchedule}
            onClick={handleSchedule}
          >
            Schedule
          </button>
          {statusMessage && <p className="quote-status">{statusMessage}</p>}
        </section>
      </div>

      <footer className="quote-footer">© 2024 QuickQuote. All rights reserved.</footer>
    </div>
  );
}
