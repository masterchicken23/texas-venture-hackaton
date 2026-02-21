import { useState, useEffect, useMemo } from "react";
import {
  ComposedChart,
  Line,
  Area,
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
      } catch (_) { }
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

  const totalRevenue = summary
    ? (summary.ride_revenue + summary.compute_revenue + summary.grid_arbitrage).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : "—";

  return (
    <div className="economics-view">
      <h1 className="view-title">ECONOMICS</h1>

      <div className="economics-chart-wrap">
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={displayData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
            <defs>
              <linearGradient id="ercotGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="jobsGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#00ff88" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#00ff88" stopOpacity={0} />
              </linearGradient>
            </defs>
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
            <Area
              yAxisId="ercot"
              type="monotone"
              dataKey="ercot"
              name="ERCOT $/MWh"
              stroke="transparent"
              fill="url(#ercotGradient)"
            />
            <Area
              yAxisId="jobs"
              type="monotone"
              dataKey="jobsPerHour"
              name="Jobs/hr (area)"
              stroke="transparent"
              fill="url(#jobsGradient)"
              legendType="none"
            />
            <Line
              yAxisId="ercot"
              type="monotone"
              dataKey="ercot"
              name="ERCOT $/MWh"
              stroke="#f59e0b"
              strokeWidth={2}
              dot={false}
              legendType="none"
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
          <span className="revenue-label">TOTAL REVENUE</span>
          <span className="revenue-value">
            ${totalRevenue}
          </span>
        </div>
      </div>

      <div className="economics-extra-cards">
        <div className="economics-extra-card">
          <div className="eco-card-icon">⚡</div>
          <span className="eco-card-label">GRID ARBITRAGE</span>
          <span className="eco-card-value green">
            ${summary?.grid_arbitrage?.toLocaleString() ?? "—"}
          </span>
        </div>
        <div className="economics-extra-card">
          <div className="eco-card-icon">☁️</div>
          <span className="eco-card-label">CLOUD EQUIVALENT</span>
          <span className="eco-card-value amber">
            ${summary?.cloud_cost_equivalent?.toLocaleString() ?? "—"}
          </span>
          <span className="eco-card-sub">What it would cost on AWS/GCP</span>
        </div>
        <div className="economics-extra-card">
          <div className="eco-card-icon">💰</div>
          <span className="eco-card-label">COST SAVINGS</span>
          <span className="eco-card-value green">
            {summary?.cost_savings_pct ?? "—"}%
          </span>
          <span className="eco-card-sub">vs. traditional cloud</span>
        </div>
        <div className="economics-extra-card">
          <div className="eco-card-icon">🌱</div>
          <span className="eco-card-label">CO₂ OFFSET</span>
          <span className="eco-card-value">
            {summary?.co2_offset_tons ?? "—"}t
          </span>
          <span className="eco-card-sub">Displaced from data centers</span>
        </div>
      </div>
    </div>
  );
}
