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
  if (Math.abs(diff) < 1e-9) return { tone: "neutral", diff: 0, arrow: "→" };

  const rising = diff > 0;
  const good = favorable === "up" ? rising : !rising;
  return { tone: good ? "pos" : "neg", diff, arrow: rising ? "▲" : "▼" };
}

const TONE = {
  pos: { bg: "rgba(72,187,120,0.14)", color: "#48BB78" },
  neg: { bg: "rgba(245,101,101,0.14)", color: "#F56565" },
  neutral: { bg: "rgba(160,174,192,0.12)", color: "#A0AEC0" },
};

function IndicatorCard({ ind, data }) {
  const d = data || {};
  const v = getVariation(d.actual, d.previous, ind.favorable);
  const tone = TONE[v.tone];
  const diffText =
    v.diff === null
      ? ""
      : `${v.arrow} ${fmtNum(Math.abs(v.diff), ind.unit)}`;

  return (
    <div className="bg-card border border-border rounded-xl px-4 py-3.5 flex flex-col">
      {/* Indicator name */}
      <div className="text-[13px] text-text-sec font-medium mb-2">{ind.label}</div>

      {/* Main row: current value + variation badge */}
      <div className="flex items-start justify-between gap-2">
        <div className="text-[26px] leading-none font-semibold text-white font-mono">
          {fmtNum(d.actual, ind.unit)}
        </div>
        <div
          className="text-xs font-semibold px-2 py-1 rounded-md whitespace-nowrap font-mono"
          style={{ backgroundColor: tone.bg, color: tone.color }}
        >
          {diffText || "—"}
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-border my-3" />

      {/* Footer: previous + date */}
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-text-dim">
          Anterior <span className="text-text-sec font-mono">{fmtNum(d.previous, ind.unit)}</span>
        </span>
        <span className="text-text-dim font-mono">{fmtDate(d.date)}</span>
      </div>

      {/* Next release */}
      {d.nextRelease && (
        <div className="text-[10px] text-text-dim mt-1.5">
          Próximo: <span className="text-text-sec font-mono">{fmtDate(d.nextRelease)}</span>
        </div>
      )}
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
      <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
        <span className="text-[20px] font-semibold text-white">Indicadores Macro · USA</span>
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
        <div className="space-y-8">
          {MACRO_CATEGORIES.map((cat) => (
            <div key={cat.name}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">{cat.icon}</span>
                <span className="text-[15px] font-semibold text-white">{cat.name}</span>
              </div>
              <div
                className="grid gap-3"
                style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}
              >
                {cat.indicators.map((ind) => (
                  <IndicatorCard key={ind.id} ind={ind} data={data?.[ind.id]} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
