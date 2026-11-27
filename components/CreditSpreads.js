"use client";
import { useState, useEffect, useMemo } from "react";
import { AreaChart, Area, LineChart, Line, ReferenceLine, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const PERIODS = [
  { key: "1M", days: 30 },
  { key: "3M", days: 90 },
  { key: "6M", days: 182 },
  { key: "1A", days: 365 },
  { key: "3A", days: 100000 }, // 3A = Máx (ICE capped at ~3 years)
];
// For 1A/3A we downsample the daily ICE series to weekly (keeps the look + perf).
const WEEKLY_PERIODS = new Set(["1A", "3A"]);

const IG_COLOR = "#5B8DEF";
const HY_COLOR = "#FFFFFF";
const CHART_H = 260;

function sliceByPeriod(data, days) {
  if (!data?.length) return [];
  const lastDate = new Date(data[data.length - 1].date);
  const cutoff = new Date(lastDate.getTime() - days * 86400000);
  return data.filter((p) => new Date(p.date) >= cutoff);
}

// ISO-week key; downsample daily rows to one (the last) observation per week.
function isoWeekKey(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const day = dt.getUTCDay() || 7;
  dt.setUTCDate(dt.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((dt - yearStart) / 86400000 + 1) / 7);
  return `${dt.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}
function toWeekly(rows) {
  const byWeek = new Map();
  for (const r of rows) byWeek.set(isoWeekKey(r.date), r);
  return [...byWeek.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
}
// Slice to the period, then (for 1A/3A) downsample to weekly.
function seriesFor(data, days, weekly) {
  const s = sliceByPeriod(data, days);
  return weekly ? toWeekly(s) : s;
}

function fmtDate(d) {
  const dt = new Date(d);
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });
}

// X-axis: one tick per month (first available point of each month), thinned to ~6.
function monthTicks(data, maxTicks = 6) {
  const seen = new Set();
  const starts = [];
  for (const p of data) {
    const m = p.date.slice(0, 7);
    if (!seen.has(m)) { seen.add(m); starts.push(p.date); }
  }
  const step = Math.max(1, Math.ceil(starts.length / maxTicks));
  return starts.filter((_, i) => i % step === 0);
}
function fmtMonth(d) {
  const dt = new Date(d);
  return dt.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

// X-axis for short periods (1M): ~weekly ticks, evenly spaced, incl. first & last.
function dayTicks(data, maxTicks = 5) {
  const n = data.length;
  if (!n) return [];
  const step = Math.max(1, Math.ceil(n / maxTicks));
  const out = [];
  for (let i = 0; i < n; i += step) out.push(data[i].date);
  if (out[out.length - 1] !== data[n - 1].date) out.push(data[n - 1].date);
  return out;
}
function fmtDayMonth(d) {
  const dt = new Date(d);
  return dt.toLocaleDateString("es-UY", { day: "numeric", month: "short" }).replace(".", "");
}

// Y-axis: round ticks (5/10/25/…) with a little air above and below.
function niceAxis(min, max) {
  if (min === max) { min -= 1; max += 1; }
  const steps = [5, 10, 25, 50, 100, 250, 500];
  const target = (max - min) / 4;
  const step = steps.find((s) => s >= target) || steps[steps.length - 1];
  let lo = Math.floor(min / step) * step;
  let hi = Math.ceil(max / step) * step;
  if (min - lo < step * 0.15) lo -= step;
  if (hi - max < step * 0.15) hi += step;
  const ticks = [];
  for (let v = lo; v <= hi + 1e-9; v += step) ticks.push(v);
  return { domain: [lo, hi], ticks };
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

function CardHeader({ name, subtitle }) {
  return (
    <div className="mb-1.5">
      <div className="flex items-center gap-2">
        <span className="w-[3px] h-3 rounded-full bg-accent" />
        <span className="text-[11px] font-bold text-accent uppercase tracking-[0.12em]">{name}</span>
      </div>
      {subtitle && <div className="text-[9.5px] text-text-sec mt-0.5 ml-[11px] leading-tight">{subtitle}</div>}
    </div>
  );
}

function SpreadChart({ cat, days, periodLabel, weekly, dayAxis }) {
  const data = useMemo(() => seriesFor(cat.data, days, weekly), [cat.data, days, weekly]);
  const subtitle = cat.id === "mortgage" ? "(proxy: tasa 30Y menos Treasury 10Y, no es el OAS del índice)" : null;

  if (!data.length) {
    return (
      <div className="border border-border rounded-md p-3">
        <CardHeader name={cat.name} subtitle={subtitle} />
        <div className="text-[11px] text-text-dim flex items-center justify-center" style={{ height: CHART_H }}>Sin datos</div>
      </div>
    );
  }
  const vals = data.map((p) => p.bps);
  const cur = vals[vals.length - 1];
  const chg = Math.round(cur - vals[0]);
  const min = Math.min(...vals), max = Math.max(...vals);
  const yAxis = niceAxis(min, max);
  const xTicks = dayAxis ? dayTicks(data) : monthTicks(data);
  const xFmt = dayAxis ? fmtDayMonth : fmtMonth;

  return (
    <div className="border border-border rounded-md p-3">
      <CardHeader name={cat.name} subtitle={subtitle} />
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-[20px] font-mono tabular-nums text-price font-semibold">{cur}<span className="text-[11px] text-text-dim ml-1">bps</span></span>
        <span className={`text-[11px] font-mono tabular-nums font-semibold ${chg > 0 ? "text-neg" : chg < 0 ? "text-pos" : "text-text-dim"}`}>
          {periodLabel}: {chg > 0 ? "+" : ""}{chg} bps
        </span>
      </div>
      <div style={{ background: "#000000", borderRadius: 6 }}>
        <ResponsiveContainer width="100%" height={CHART_H}>
          <AreaChart data={data} margin={{ top: 8, right: 14, left: 4, bottom: 0 }}>
            <defs>
              <linearGradient id={`sg-${cat.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#031D38" stopOpacity={1} />
                <stop offset="100%" stopColor="#031D38" stopOpacity={1} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="2 2" stroke="#FFFFFF" strokeOpacity={0.15} />
            <XAxis dataKey="date" ticks={xTicks} interval={0} tick={{ fill: "#94A3B8", fontSize: 9, fontFamily: "'Source Code Pro',monospace" }} tickLine={false} axisLine={{ stroke: "#1E2D40" }} tickFormatter={xFmt} />
            <YAxis domain={yAxis.domain} ticks={yAxis.ticks} tick={{ fill: "#94A3B8", fontSize: 9, fontFamily: "'Source Code Pro',monospace" }} tickLine={false} axisLine={false} width={38} />
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

function CompareChart({ hist, days, weekly, dayAxis }) {
  const data = useMemo(() => {
    const ig = hist.find((c) => c.id === "usig");
    const hy = hist.find((c) => c.id === "ushy");
    if (!ig || !hy) return [];
    const igS = seriesFor(ig.data, days, weekly);
    const hyMap = new Map(seriesFor(hy.data, days, weekly).map((p) => [p.date, p.bps]));
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
  }, [hist, days, weekly]);

  if (!data.length) return null;
  const allVals = data.flatMap((p) => [p.ig, p.hy]).concat([100]);
  const yAxis = niceAxis(Math.min(...allVals), Math.max(...allVals));
  const xTicks = dayAxis ? dayTicks(data) : monthTicks(data);
  const xFmt = dayAxis ? fmtDayMonth : fmtMonth;

  return (
    <div className="border border-border rounded-md p-3">
      <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
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
        <ResponsiveContainer width="100%" height={CHART_H}>
          <LineChart data={data} margin={{ top: 8, right: 14, left: 4, bottom: 0 }}>
            <CartesianGrid strokeDasharray="2 2" stroke="#FFFFFF" strokeOpacity={0.15} />
            <XAxis dataKey="date" ticks={xTicks} interval={0} tick={{ fill: "#94A3B8", fontSize: 9, fontFamily: "'Source Code Pro',monospace" }} tickLine={false} axisLine={{ stroke: "#1E2D40" }} tickFormatter={xFmt} />
            <YAxis domain={yAxis.domain} ticks={yAxis.ticks} tick={{ fill: "#94A3B8", fontSize: 9, fontFamily: "'Source Code Pro',monospace" }} tickLine={false} axisLine={false} width={38} />
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

const CHART_ORDER = ["usig", "ushy", "emcorp", "eurohy", "mortgage"];

export default function CreditSpreads() {
  const [hist, setHist] = useState(null);
  const [error, setError] = useState(false);
  const [period, setPeriod] = useState("1A");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/spreads-history")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d && Array.isArray(d.categories) && d.categories.length) setHist(d.categories);
        else setError(true);
      })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, []);

  const days = PERIODS.find((p) => p.key === period)?.days ?? 365;
  const weekly = WEEKLY_PERIODS.has(period);
  const dayAxis = period === "1M";
  const ordered = hist ? CHART_ORDER.map((id) => hist.find((c) => c.id === id)).filter(Boolean) : [];

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <span className="w-[3px] h-3.5 rounded-full bg-accent" />
          <span className="text-[13px] font-bold text-accent uppercase tracking-[0.15em]">Credit Spreads</span>
        </div>
        {hist && (
          <div className="flex items-center gap-1">
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
        )}
      </div>

      {hist === null && !error ? (
        <div className="text-xs text-text-dim h-40 flex items-center justify-center">Cargando spreads...</div>
      ) : error && hist === null ? (
        <div className="text-xs text-text-dim h-40 flex items-center justify-center">No se pudieron cargar los spreads.</div>
      ) : (
        <>
          <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {ordered.map((cat) => (
              <SpreadChart key={cat.id} cat={cat} days={days} periodLabel={period} weekly={weekly} dayAxis={dayAxis} />
            ))}
            <CompareChart hist={hist} days={days} weekly={weekly} dayAxis={dayAxis} />
          </div>
          <div className="text-[10px] text-text-dim mt-3 leading-relaxed">
            Spreads OAS vía ICE BofA Indices (FRED). Historia ICE BofA limitada a ~3 años por licencia de FRED.
            Global IG/HY, US Munis, Canada IG, Europe IG no disponibles sin Bloomberg — no incluidos.
          </div>
        </>
      )}
    </div>
  );
}
