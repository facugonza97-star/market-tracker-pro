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

function CustomLabel({ x, y, value }) {
  if (value === null || value === undefined) return null;
  return (
    <text x={x} y={y - 10} fill="#ffffff" fontSize={9} fontWeight="bold" textAnchor="middle">
      {value.toFixed(2)}%
    </text>
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
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex justify-between items-baseline mb-3">
        <span className="text-xs font-semibold text-white">🇺🇸 US Treasury Yield Curve</span>
        <span className="text-[10px] text-text-dim">All maturities</span>
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 20, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="yieldGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#5B8DEF" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#5B8DEF" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1C2536" />
          <XAxis
            dataKey="mat"
            tick={{ fill: "#ffffff", fontSize: 10, fontWeight: "bold" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[minRate, maxRate]}
            tick={{ fill: "#ffffff", fontSize: 10, fontWeight: "bold" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => v.toFixed(1) + "%"}
            width={45}
          />
          <Tooltip
            contentStyle={{
              background: "#0F1520",
              border: "1px solid #1C2536",
              borderRadius: 6,
              fontSize: 12,
            }}
            formatter={(v) => [v.toFixed(2) + "%", "Yield"]}
          />
          <Area
            type="monotone"
            dataKey="rate"
            stroke="#5B8DEF"
            strokeWidth={2}
            fill="url(#yieldGrad)"
            dot={{ r: full ? 4 : 2.5, fill: "#5B8DEF", strokeWidth: 0 }}
            activeDot={{ r: 6 }}
          >
            <LabelList dataKey="rate" content={<CustomLabel />} />
          </Area>
        </AreaChart>
      </ResponsiveContainer>
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
            <div className="mt-2 px-2">
              <p className="text-[10px] text-white">• Si el spread es negativo la curva está invertida: inversores esperan menor crecimiento y tasas más bajas, prefiriendo asegurar rendimientos largos ante expectativa de recesión.</p>
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
