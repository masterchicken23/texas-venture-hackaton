import { useState, useEffect, useMemo } from "react";
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { getErcotCurrent, getEconomicsSummary } from "./api";

const CHART_POINTS = 40;
const APPEND_INTERVAL_MS = 4000;

function formatTime(iso) {
  try {
    return new Date(iso).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return "";
  }
}

export default function EconomicsView() {
  const [summary, setSummary] = useState(null);
  const [chartData, setChartData] = useState([]);

  useEffect(() => {
    const appendPoint = async () => {
      try {
        const [curr, sum] = await Promise.all([
          getErcotCurrent(),
          getEconomicsSummary(),
        ]);
        setSummary(sum);
        setChartData((prev) => {
          const newPoint = {
            time: curr.timestamp,
            ercot: curr.price,
            jobsPerHour: sum.jobs_per_hour,
          };
          return [...prev, newPoint].slice(-CHART_POINTS);
        });
      } catch (_) {}
    };
    appendPoint();
    const id = setInterval(appendPoint, APPEND_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  const displayData = useMemo(
    () =>
      chartData.map((d) => ({
        ...d,
        label: formatTime(d.time),
      })),
    [chartData]
  );

  return (
    <div className="economics-view">
      <h1 className="view-title">ECONOMICS</h1>

      <div className="economics-chart-wrap">
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={displayData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis
              dataKey="label"
              stroke="#64748b"
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              tickFormatter={(v) => (v || "").slice(0, 8)}
            />
            <YAxis
              yAxisId="ercot"
              stroke="#f59e0b"
              tick={{ fill: "#f59e0b", fontSize: 11 }}
              domain={["auto", "auto"]}
            />
            <YAxis
              yAxisId="jobs"
              orientation="right"
              stroke="#00ff88"
              tick={{ fill: "#00ff88", fontSize: 11 }}
              domain={["auto", "auto"]}
            />
            <Tooltip
              contentStyle={{
                background: "#0f172a",
                border: "1px solid #334155",
                borderRadius: 0,
              }}
              labelFormatter={formatTime}
            />
            <Legend />
            <Line
              yAxisId="ercot"
              type="monotone"
              dataKey="ercot"
              name="ERCOT $/MWh"
              stroke="#f59e0b"
              strokeWidth={2}
              dot={false}
            />
            <Line
              yAxisId="jobs"
              type="monotone"
              dataKey="jobsPerHour"
              name="Jobs/hr"
              stroke="#00ff88"
              strokeWidth={2}
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="revenue-cards">
        <div className="revenue-card">
          <span className="revenue-label">RIDE REVENUE</span>
          <span className="revenue-value">
            ${summary?.ride_revenue?.toLocaleString() ?? "—"}
          </span>
        </div>
        <div className="revenue-card">
          <span className="revenue-label">COMPUTE REVENUE</span>
          <span className="revenue-value">
            ${summary?.compute_revenue?.toLocaleString() ?? "—"}
          </span>
        </div>
        <div className="revenue-card">
          <span className="revenue-label">GRID ARBITRAGE</span>
          <span className="revenue-value">
            ${summary?.grid_arbitrage?.toLocaleString() ?? "—"}
          </span>
        </div>
      </div>
    </div>
  );
}
