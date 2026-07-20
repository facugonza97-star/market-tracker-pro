"use client";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from "recharts";

const MATURITIES = [
  { key: "month1", label: "1M" },
  { key: "month3", label: "3M" },
  { key: "month6", label: "6M" },
  { key: "year1", label: "1Y" },
  { key: "year2", label: "2Y" },
  { key: "year3", label: "3Y" },
  { key: "year5", label: "5Y" },
  { key: "year7", label: "7Y" },
  { key: "year10", label: "10Y" },
  { key: "year20", label: "20Y" },
  { key: "year30", label: "30Y" },
];

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "#0F1520",
      border: "1px solid #2A3A50",
      borderRadius: 8,
      padding: "8px 12px",
    }}>
      <div style={{ color: "#94A3B8", fontSize: 11, marginBottom: 2 }}>{label}</div>
      <div style={{ color: "#ffffff", fontSize: 15, fontWeight: 600, fontFamily: "monospace" }}>
        {payload[0].value.toFixed(2)}%
      </div>
    </div>
  );
}

export default function YieldCurve({ treasury, full }) {
  if (!treasury) return null;

  const data = MATURITIES.map((m) => ({
    mat: m.label,
    rate: treasury[m.key] ? parseFloat(treasury[m.key]) : null,
  })).filter((d) => d.rate !== null);

  const rates = data.map((d) => d.rate);
  const minRate = Math.floor(Math.min(...rates) * 10) / 10 - 0.2;
  const maxRate = Math.ceil(Math.max(...rates) * 10) / 10 + 0.4;

  const spread10y2y = (treasury.year10 && treasury.year2)
    ? (parseFloat(treasury.year10) - parseFloat(treasury.year2)).toFixed(2)
    : null;

  const height = full ? 360 : 200;

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex justify-between items-baseline mb-4">
        <span className="text-[20px] font-semibold text-white">🇺🇸 US Treasury Yield Curve</span>
        <span className="text-xs text-text-dim">All maturities</span>
      </div>
      <div style={{ background: "#000000", borderRadius: 8, padding: "8px 4px" }}>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 25, right: 15, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="yieldGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#031D38" stopOpacity={1} />
              <stop offset="100%" stopColor="#031D38" stopOpacity={1} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="2 2" stroke="#FFFFFF" strokeOpacity={0.15} />
          <XAxis
            dataKey="mat"
            tick={{ fill: "#94A3B8", fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: "#1E2D40" }}
          />
          <YAxis
            domain={[minRate, maxRate]}
            tick={{ fill: "#94A3B8", fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => v.toFixed(1) + "%"}
            width={50}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: "#5B8DEF", strokeOpacity: 0.3 }} />
          <Area
            type="monotone"
            dataKey="rate"
            stroke="#FFFFFF"
            strokeWidth={2}
            fill="url(#yieldGrad)"
            dot={{ r: 4, fill: "#FFFFFF", strokeWidth: 0 }}
            activeDot={{ r: 6, fill: "#FFFFFF", stroke: "#132A4D", strokeWidth: 2 }}
          >
            <LabelList dataKey="rate" position="top" offset={10} formatter={(v) => v.toFixed(2) + "%"} style={{ fontSize: 11, fill: "#FFFFFF", fontWeight: 600 }} />
          </Area>
        </AreaChart>
      </ResponsiveContainer>
      </div>
      {spread10y2y !== null && (() => {
        const s = parseFloat(spread10y2y);
        let label, color;
        if (s > 2.0)      { label = "Steep"; color = "#228B22"; }
        else if (s >= 0.5) { label = "Normal"; color = "#3CB371"; }
        else if (s >= 0)   { label = "Flat"; color = "#EAB308"; }
        else               { label = "Inverted"; color = "#DC2626"; }
        return (
          <div className="mt-3">
            <div className="text-center">
              <span className="text-[11px] font-bold text-white tracking-wide">
                10Y – 2Y SPREAD: {spread10y2y}%
              </span>
              <span className="text-[11px] ml-2" style={{ color }}>
                · {label} (LT avg: 0.85%)
              </span>
            </div>
          </div>
        );
      })()}
      {full && (
        <div className="flex gap-2 mt-4 flex-wrap">
          {data.map((d, i) => (
            <div
              key={i}
              className="bg-bg border border-border rounded-md px-3 py-2 text-center flex-1 min-w-[60px]"
            >
              <div className="text-[9px] text-text-dim">{d.mat}</div>
              <div className="text-sm font-bold text-white font-mono">{d.rate.toFixed(2)}%</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
