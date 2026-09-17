"use client";
import { useState, useEffect } from "react";

function pct(v) {
  return v == null ? "—" : v.toFixed(1) + "%";
}

export default function SilverCapture() {
  const [d, setD] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/silver-capture")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data && Array.isArray(data.periods) && data.periods.length) setD(data);
        else setError(true);
      })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, []);

  const th = "px-3 py-2.5 text-[11px] font-bold text-[#94A3B8] uppercase tracking-wide";
  const vcell = "px-3 py-1.5 text-right text-[14px] text-white font-mono tabular-nums border-r border-white/5";

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center gap-2.5 mb-4">
        <span className="w-[3px] h-3.5 rounded-full bg-accent" />
        <span className="text-[13px] font-bold text-accent uppercase tracking-[0.15em]">
          Plata vs. Oro — Upside/Downside Capture
        </span>
      </div>

      {d === null && !error ? (
        <div className="text-xs text-text-dim h-40 flex items-center justify-center">Calculando capture...</div>
      ) : error && d === null ? (
        <div className="text-xs text-text-dim h-40 flex items-center justify-center">No se pudo calcular el capture.</div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full min-w-[560px]" style={{ background: "#000000", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#0d0d1a" }}>
                  <th className={`${th} text-left border-r border-white/10`}>Métrica</th>
                  {d.periods.map((p) => (
                    <th key={p} className={`${th} text-right border-r border-white/10 last:border-r-0`}>{p}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-white/5 hover:bg-[#1a2f52]">
                  <td className="px-3 py-1.5 text-[13px] text-price border-r border-white/5 whitespace-nowrap">Upside Capture</td>
                  {d.upside.map((v, i) => (<td key={i} className={vcell + " last:border-r-0"}>{pct(v)}</td>))}
                </tr>
                <tr className="border-b border-white/5 hover:bg-[#1a2f52]">
                  <td className="px-3 py-1.5 text-[13px] text-price border-r border-white/5 whitespace-nowrap">Downside Capture</td>
                  {d.downside.map((v, i) => (<td key={i} className={vcell + " last:border-r-0"}>{pct(v)}</td>))}
                </tr>
                <tr className="border-b border-white/5 hover:bg-[#1a2f52]">
                  <td className="px-3 py-1.5 text-[13px] text-price border-r border-white/5 whitespace-nowrap">Capture Ratio</td>
                  {d.ratio.map((v, i) => (
                    <td
                      key={i}
                      className={`px-3 py-1.5 text-right text-[14px] font-mono tabular-nums font-semibold border-r border-white/5 last:border-r-0 ${
                        v == null ? "text-white" : v >= 1 ? "text-pos" : "text-neg"
                      }`}
                    >
                      {v == null ? "—" : v.toFixed(2)}
                    </td>
                  ))}
                </tr>
                {/* observation counts, discrete */}
                <tr>
                  <td className="px-3 py-1.5 text-[10px] text-text-dim border-r border-white/5 whitespace-nowrap">n (↑ / ↓)</td>
                  {d.nUp.map((v, i) => (
                    <td key={i} className="px-3 py-1.5 text-right text-[10px] text-text-dim font-mono border-r border-white/5 last:border-r-0">
                      {v == null ? "—" : `${v} / ${d.nDown[i]}`}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          <div className="text-[10px] text-text-dim mt-2.5 leading-relaxed">
            Cálculo propio sobre precios diarios GCUSD/SIUSD (FMP), resampleados a cada frecuencia.
            Período: {d.from} → {d.to} (~{d.years} años). Ratio &gt;1 = la Plata captura más del upside que del downside del Oro. n bajo (ej. Anual) = menos confiable.
          </div>
        </>
      )}
    </div>
  );
}
