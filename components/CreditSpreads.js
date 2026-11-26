"use client";
import { useState, useEffect, useMemo } from "react";
import { AreaChart, Area, LineChart, Line, ReferenceLine, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const PERIODS = [
  { key: "3M", days: 90 },
  { key: "6M", days: 182 },
  { key: "1A", days: 365 },
  { key: "3A", days: 100000 }, // 3A = Máx (ICE capped at ~3 years)
];

function sliceByPeriod(data, days) {
  if (!data?.length) return [];
  const lastDate = new Date(data[data.length - 1].date);
  const cutoff = new Date(lastDate.getTime() - days * 86400000);
  return data.filter((p) => new Date(p.date) >= cutoff);
}

function fmtDate(d) {
  const dt = new Date(d);
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });
}

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div style={{ background: "#0F1520", border: "1px solid #2A3A50", borderRadius: 8, padding: "6px 10px", fontFamily: "'Source Code Pro',monospace" }}>
      <div style={{ color: "#94A3B8", fontSize: 10 }}>{fmtDate(p.date)}</div>
      <div style={{ color: "#fff", fontSize: 13, fontWeight: 600 }}>{p.bps} bps</div>
    </div>
  );
}

function SpreadChart({ cat, days }) {
  const data = useMemo(() => sliceByPeriod(cat.data, days), [cat.data, days]);
  if (!data.length) {
    return (
      <div className="border border-border rounded-md p-3">
        <div className="text-[11px] font-bold text-accent uppercase tracking-[0.12em] mb-2">{cat.name}</div>
        <div className="text-[11px] text-text-dim h-[120px] flex items-center justify-center">Sin datos</div>
      </div>
    );
  }
  const vals = data.map((p) => p.bps);
  const cur = vals[vals.length - 1];
  const chg = Math.round(cur - vals[0]);
  const min = Math.min(...vals), max = Math.max(...vals);

  return (
    <div className="border border-border rounded-md p-3">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="w-[3px] h-3 rounded-full bg-accent" />
        <span className="text-[11px] font-bold text-accent uppercase tracking-[0.12em]">{cat.name}</span>
      </div>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-[18px] font-mono tabular-nums text-price font-semibold">{cur}<span className="text-[11px] text-text-dim ml-1">bps</span></span>
        <span className={`text-[11px] font-mono tabular-nums font-semibold ${chg > 0 ? "text-neg" : chg < 0 ? "text-pos" : "text-text-dim"}`}>
          {chg > 0 ? "+" : ""}{chg} bps
        </span>
      </div>
      <div style={{ background: "#000000", borderRadius: 6 }}>
        <ResponsiveContainer width="100%" height={120}>
          <AreaChart data={data} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`sg-${cat.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#031D38" stopOpacity={1} />
                <stop offset="100%" stopColor="#031D38" stopOpacity={1} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="2 2" stroke="#FFFFFF" strokeOpacity={0.15} />
            <XAxis dataKey="date" tick={{ fill: "#94A3B8", fontSize: 9, fontFamily: "'Source Code Pro',monospace" }} tickLine={false} axisLine={{ stroke: "#1E2D40" }} minTickGap={40} tickFormatter={fmtDate} />
            <YAxis tick={{ fill: "#94A3B8", fontSize: 9, fontFamily: "'Source Code Pro',monospace" }} tickLine={false} axisLine={false} width={32} domain={["dataMin", "dataMax"]} />
            <Tooltip content={<ChartTooltip />} cursor={{ stroke: "#5B8DEF", strokeOpacity: 0.3 }} />
            <Area type="monotone" dataKey="bps" stroke="#FFFFFF" strokeWidth={1.5} fill={`url(#sg-${cat.id})`} dot={false} activeDot={{ r: 3, fill: "#FFFFFF", stroke: "#132A4D", strokeWidth: 1.5 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="flex justify-between text-[10px] text-text-sec font-mono mt-1.5">
        <span>mín {min}</span>
        <span>máx {max}</span>
      </div>
    </div>
  );
}

const IG_COLOR = "#5B8DEF";
const HY_COLOR = "#FFFFFF";

function CompareTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div style={{ background: "#0F1520", border: "1px solid #2A3A50", borderRadius: 8, padding: "6px 10px", fontFamily: "'Source Code Pro',monospace" }}>
      <div style={{ color: "#94A3B8", fontSize: 10, marginBottom: 3 }}>{fmtDate(p.date)}</div>
      <div style={{ color: HY_COLOR, fontSize: 12, fontWeight: 600 }}>
        US HY {p.hy?.toFixed(1)} <span style={{ color: "#94A3B8", fontWeight: 400 }}>({p.hyBps} bp)</span>
      </div>
      <div style={{ color: IG_COLOR, fontSize: 12, fontWeight: 600, marginTop: 2 }}>
        US IG {p.ig?.toFixed(1)} <span style={{ color: "#94A3B8", fontWeight: 400 }}>({p.igBps} bp)</span>
      </div>
    </div>
  );
}

function CompareChart({ hist, days }) {
  const data = useMemo(() => {
    const ig = hist.find((c) => c.id === "usig");
    const hy = hist.find((c) => c.id === "ushy");
    if (!ig || !hy) return [];
    const igS = sliceByPeriod(ig.data, days);
    const hyS = sliceByPeriod(hy.data, days);
    const hyMap = new Map(hyS.map((p) => [p.date, p.bps]));
    const base = { ig: igS[0]?.bps, hy: hyMap.get(igS[0]?.date) };
    if (!base.ig || !base.hy) return [];
    const out = [];
    for (const p of igS) {
      const hyBps = hyMap.get(p.date);
      if (hyBps == null) continue;
      out.push({
        date: p.date,
        igBps: p.bps,
        hyBps,
        ig: +((p.bps / base.ig) * 100).toFixed(2),
        hy: +((hyBps / base.hy) * 100).toFixed(2),
      });
    }
    return out;
  }, [hist, days]);

  if (!data.length) return null;

  return (
    <div className="border border-border rounded-md p-3 mt-3">
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="w-[3px] h-3 rounded-full bg-accent" />
          <span className="text-[11px] font-bold text-accent uppercase tracking-[0.12em]">IG vs HY (base 100)</span>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-text-sec font-mono">
          <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-[2px]" style={{ background: HY_COLOR }} />US HY</span>
          <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-[2px]" style={{ background: IG_COLOR }} />US IG</span>
        </div>
      </div>
      <div style={{ background: "#000000", borderRadius: 6 }}>
        <ResponsiveContainer width="100%" height={170}>
          <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="2 2" stroke="#FFFFFF" strokeOpacity={0.15} />
            <XAxis dataKey="date" tick={{ fill: "#94A3B8", fontSize: 9, fontFamily: "'Source Code Pro',monospace" }} tickLine={false} axisLine={{ stroke: "#1E2D40" }} minTickGap={50} tickFormatter={fmtDate} />
            <YAxis tick={{ fill: "#94A3B8", fontSize: 9, fontFamily: "'Source Code Pro',monospace" }} tickLine={false} axisLine={false} width={34} domain={["dataMin", "dataMax"]} />
            <ReferenceLine y={100} stroke="#FFFFFF" strokeOpacity={0.25} strokeDasharray="4 4" />
            <Tooltip content={<CompareTooltip />} cursor={{ stroke: "#5B8DEF", strokeOpacity: 0.3 }} />
            <Line type="monotone" dataKey="hy" stroke={HY_COLOR} strokeWidth={1.5} dot={false} activeDot={{ r: 3, fill: HY_COLOR, stroke: "#132A4D", strokeWidth: 1.5 }} />
            <Line type="monotone" dataKey="ig" stroke={IG_COLOR} strokeWidth={1.5} dot={false} activeDot={{ r: 3, fill: IG_COLOR, stroke: "#132A4D", strokeWidth: 1.5 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default function CreditSpreads() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(false);
  const [hist, setHist] = useState(null);
  const [period, setPeriod] = useState("1A");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/spreads")
      .then((r) => r.json())
      .then((d) => { if (!cancelled) (d && Array.isArray(d.rows)) ? setRows(d.rows) : setError(true); })
      .catch(() => { if (!cancelled) setError(true); });
    fetch("/api/spreads-history")
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d && Array.isArray(d.categories)) setHist(d.categories); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const th = "px-3 py-2.5 text-[11px] font-bold text-[#94A3B8] uppercase tracking-wide";
  const days = PERIODS.find((p) => p.key === period)?.days ?? 365;

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center gap-2.5 mb-4">
        <span className="w-[3px] h-3.5 rounded-full bg-accent" />
        <span className="text-[13px] font-bold text-accent uppercase tracking-[0.15em]">Credit Spreads</span>
      </div>

      {rows === null && !error ? (
        <div className="text-xs text-text-dim">Cargando spreads...</div>
      ) : error && rows === null ? (
        <div className="text-xs text-text-dim">No se pudieron cargar los spreads.</div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full min-w-[320px]" style={{ background: "#000000", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#0d0d1a" }}>
                  <th className={`${th} text-left border-r border-white/10`}>Categoría</th>
                  <th className={`${th} text-right`}>Spread (bps)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-b border-white/5 hover:bg-[#1a2f52]">
                    <td className="px-3 py-1.5 text-[13px] text-price border-r border-white/5">{r.category}</td>
                    <td className="px-3 py-1.5 text-right text-[15px] text-white font-mono tabular-nums">
                      {r.bps === null || r.bps === undefined ? "—" : r.bps}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {hist && hist.length > 0 && (
            <>
              <div className="flex items-center gap-1 mt-4 mb-3">
                {PERIODS.map((p) => (
                  <button
                    key={p.key}
                    onClick={() => setPeriod(p.key)}
                    className={`px-2.5 py-1 rounded text-[11px] font-semibold transition border ${
                      period === p.key ? "bg-white/10 border-white/30 text-white" : "bg-card border-border text-text-sec hover:text-white"
                    }`}
                  >
                    {p.key}
                  </button>
                ))}
                <span className="text-[10px] text-text-dim ml-1">3A = máx</span>
              </div>
              <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
                {hist.map((cat) => (
                  <SpreadChart key={cat.id} cat={cat} days={days} />
                ))}
              </div>
              <CompareChart hist={hist} days={days} />
            </>
          )}

          <div className="text-[10px] text-text-dim mt-3 leading-relaxed">
            Spreads OAS vía ICE BofA Indices (FRED). Historia ICE BofA limitada a ~3 años por licencia de FRED.
            Global IG/HY, US Munis, Canada IG, Europe IG no disponibles sin Bloomberg — no incluidos.
          </div>
        </>
      )}
    </div>
  );
}
