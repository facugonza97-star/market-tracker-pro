"use client";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

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

export default function YieldCurve({ treasury, full }) {
  if (!treasury) return null;

  const data = MATURITIES.map((m) => ({
    mat: m.label,
    rate: treasury[m.key] ? parseFloat(treasury[m.key]) : null,
  })).filter((d) => d.rate !== null);

  const rates = data.map((d) => d.rate);
  const minRate = Math.floor(Math.min(...rates) * 10) / 10 - 0.2;
  const maxRate = Math.ceil(Math.max(...rates) * 10) / 10 + 0.2;

  const height = full ? 360 : 200;

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex justify-between items-baseline mb-3">
        <span className="text-xs font-semibold text-white">US Treasury Yield Curve</span>
        <span className="text-[10px] text-text-dim">All maturities</span>
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="yieldGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#5B8DEF" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#5B8DEF" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1C2536" />
          <XAxis
            dataKey="mat"
            tick={{ fill: "#4A5568", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[minRate, maxRate]}
            tick={{ fill: "#4A5568", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => v.toFixed(1) + "%"}
            width={40}
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
          />
        </AreaChart>
      </ResponsiveContainer>
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
