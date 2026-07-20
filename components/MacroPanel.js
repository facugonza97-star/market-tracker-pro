"use client";
import React, { useState, useEffect } from "react";
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
// the indicator's explicit favorable direction. (Logic unchanged — layout only.)
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

const TONE_CLASS = { pos: "text-pos", neg: "text-neg", neutral: "text-text-dim" };

function IndicatorRow({ ind, data }) {
  const d = data || {};
  const v = getVariation(d.actual, d.previous, ind.favorable);
  const diffText =
    v.diff === null || v.diff === 0 ? "—" : `${v.arrow} ${fmtNum(Math.abs(v.diff), ind.unit)}`;

  return (
    <tr className="border-b border-white/5 hover:bg-[#1a2f52]">
      <td className="px-3 py-1.5 text-[13px] text-price border-r border-white/5 whitespace-nowrap">
        {ind.label}
      </td>
      <td className="px-3 py-1.5 text-right text-[15px] text-white font-mono tabular-nums border-r border-white/5">
        {fmtNum(d.actual, ind.unit)}
      </td>
      <td className="px-3 py-1.5 text-right text-[13px] text-text-dim font-mono tabular-nums border-r border-white/5">
        {fmtNum(d.previous, ind.unit)}
      </td>
      <td className={`px-3 py-1.5 text-right text-[13px] font-mono tabular-nums font-semibold border-r border-white/5 whitespace-nowrap ${TONE_CLASS[v.tone]}`}>
        {diffText}
      </td>
      <td className="px-3 py-1.5 text-right text-[11px] text-text-sec font-mono border-r border-white/5 whitespace-nowrap">
        {fmtDate(d.date)}
      </td>
      <td className="px-3 py-1.5 text-right text-[11px] text-text-sec font-mono whitespace-nowrap">
        {fmtDate(d.nextRelease)}
      </td>
    </tr>
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

  const th = "px-3 py-2.5 text-[11px] font-bold text-[#94A3B8] uppercase tracking-wide";

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
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full min-w-[720px]" style={{ background: "#000000", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#0d0d1a" }}>
                <th className={`${th} text-left border-r border-white/10`}>Indicador</th>
                <th className={`${th} text-right border-r border-white/10`}>Actual</th>
                <th className={`${th} text-right border-r border-white/10`}>Anterior</th>
                <th className={`${th} text-right border-r border-white/10`}>Variación</th>
                <th className={`${th} text-right border-r border-white/10`}>Fecha</th>
                <th className={`${th} text-right`}>Próximo</th>
              </tr>
            </thead>
            <tbody>
              {MACRO_CATEGORIES.map((cat) => (
                <React.Fragment key={cat.name}>
                  <tr className="bg-card">
                    <td colSpan={6} className="px-3 py-1.5">
                      <span className="text-[11px] font-bold text-accent uppercase tracking-[0.18em]">
                        {cat.name}
                      </span>
                    </td>
                  </tr>
                  {cat.indicators.map((ind) => (
                    <IndicatorRow key={ind.id} ind={ind} data={data?.[ind.id]} />
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
