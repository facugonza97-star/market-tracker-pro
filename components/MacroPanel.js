"use client";
import { useState, useEffect } from "react";
import { MACRO_CATEGORIES } from "@/lib/macroConfig";

function fmtDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d)) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtNum(v, unit) {
  if (v === null || v === undefined) return "—";
  const n = typeof v === "number" ? v : parseFloat(v);
  if (isNaN(n)) return "—";
  const s = Number.isInteger(n) ? n.toLocaleString("en-US") : n.toFixed(n >= 100 ? 1 : 2);
  return unit ? `${s}${unit}` : s;
}

// Returns { tone: 'pos'|'neg'|'neutral', diff, arrow } given the raw values and
// the indicator's explicit favorable direction.
function getVariation(actual, previous, favorable) {
  const a = typeof actual === "number" ? actual : parseFloat(actual);
  const p = typeof previous === "number" ? previous : parseFloat(previous);
  if (isNaN(a) || isNaN(p)) return { tone: "neutral", diff: null, arrow: "" };

  const diff = a - p;
  if (Math.abs(diff) < 1e-9) return { tone: "neutral", diff: 0, arrow: "" };

  const rising = diff > 0;
  const good = favorable === "up" ? rising : !rising;
  return { tone: good ? "pos" : "neg", diff, arrow: rising ? "▲" : "▼" };
}

// Color-only signal — no filled pills. Matches the app's pos/neg palette.
const TONE_COLOR = {
  pos: "#48BB78",
  neg: "#F56565",
  neutral: "#6B7280",
};

function IndicatorCell({ ind, data }) {
  const d = data || {};
  const v = getVariation(d.actual, d.previous, ind.favorable);
  const color = TONE_COLOR[v.tone];
  const diffText =
    v.diff === null || v.diff === 0
      ? null
      : `${v.arrow} ${fmtNum(Math.abs(v.diff), ind.unit)}`;

  return (
    <div className="bg-card px-4 py-3 flex flex-col">
      {/* Indicator name */}
      <div className="text-[12px] text-text-sec mb-2 truncate">{ind.label}</div>

      {/* Main row: current value + variation */}
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[24px] leading-none font-semibold text-white font-mono tabular-nums">
          {fmtNum(d.actual, ind.unit)}
        </span>
        <span
          className="text-[12px] font-semibold font-mono tabular-nums whitespace-nowrap"
          style={{ color }}
        >
          {diffText || <span className="text-text-dim">—</span>}
        </span>
      </div>

      {/* Footer: previous + date */}
      <div className="flex items-center justify-between text-[10.5px] mt-3 pt-2.5 border-t border-border/60">
        <span className="text-text-dim">
          Ant.{" "}
          <span className="text-text-sec font-mono tabular-nums">{fmtNum(d.previous, ind.unit)}</span>
        </span>
        <span className="text-text-dim font-mono tabular-nums">{fmtDate(d.date)}</span>
      </div>

      {/* Next release */}
      <div className="text-[10px] text-text-dim/80 mt-1">
        {d.nextRelease ? (
          <>Próx. <span className="font-mono tabular-nums">{fmtDate(d.nextRelease)}</span></>
        ) : (
          <span className="opacity-0">·</span>
        )}
      </div>
    </div>
  );
}

function CategorySection({ cat, data }) {
  return (
    <div>
      {/* Eyebrow header: accent bar + uppercase spaced label (no emoji) */}
      <div className="flex items-center gap-2.5 mb-2.5">
        <span className="w-[3px] h-3.5 rounded-full bg-accent" />
        <span className="text-[11px] font-bold text-text-sec uppercase tracking-[0.18em]">
          {cat.name}
        </span>
      </div>

      {/* Data grid — hairline dividers via 1px gap over the border color */}
      <div
        className="grid rounded-md overflow-hidden border border-border"
        style={{
          gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))",
          gap: "1px",
          backgroundColor: "#1C2536",
        }}
      >
        {cat.indicators.map((ind) => (
          <IndicatorCell key={ind.id} ind={ind} data={data?.[ind.id]} />
        ))}
      </div>
    </div>
  );
}

export default function MacroPanel() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = () => {
      fetch("/api/macro-indicators")
        .then((r) => r.json())
        .then((d) => {
          if (cancelled) return;
          if (d && d.indicators) {
            setData(d.indicators);
            setError(false);
          } else {
            setError(true);
          }
        })
        .catch(() => {
          if (!cancelled) setError(true);
        });
    };

    load();
    // Refresh periodically; server-side cache (1h) shields FMP quota.
    const interval = setInterval(load, 15 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="px-6 py-5">
      <div className="flex items-baseline justify-between mb-5 flex-wrap gap-2">
        <span className="text-[20px] font-semibold text-white">Indicadores Macro · USA</span>
        <span className="text-[11px] text-text-dim uppercase tracking-wider">Fuente: FMP</span>
      </div>

      {data === null && !error ? (
        <div className="flex items-center justify-center h-64 text-text-sec text-sm">
          Cargando indicadores...
        </div>
      ) : error && data === null ? (
        <div className="flex items-center justify-center h-64 text-text-sec text-sm">
          No se pudieron cargar los indicadores. Intentá de nuevo más tarde.
        </div>
      ) : (
        <div className="space-y-7">
          {MACRO_CATEGORIES.map((cat) => (
            <CategorySection key={cat.name} cat={cat} data={data} />
          ))}
        </div>
      )}
    </div>
  );
}
