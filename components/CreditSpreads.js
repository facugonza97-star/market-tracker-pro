"use client";
import { useState, useEffect } from "react";

export default function CreditSpreads() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/spreads")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d && Array.isArray(d.rows)) setRows(d.rows);
        else setError(true);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const th = "px-3 py-2.5 text-[11px] font-bold text-[#94A3B8] uppercase tracking-wide";

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
            <table className="w-full min-w-[520px]" style={{ background: "#000000", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#0d0d1a" }}>
                  <th className={`${th} text-left border-r border-white/10`}>Categoría</th>
                  <th className={`${th} text-right border-r border-white/10`}>Spread (bps)</th>
                  <th className={`${th} text-left`}>Fuente</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-b border-white/5 hover:bg-[#1a2f52]">
                    <td className="px-3 py-1.5 text-[13px] text-price border-r border-white/5">{r.category}</td>
                    <td className="px-3 py-1.5 text-right text-[15px] text-white font-mono tabular-nums border-r border-white/5">
                      {r.bps === null || r.bps === undefined ? "—" : r.bps}
                    </td>
                    <td className="px-3 py-1.5 text-[11px] text-text-sec font-mono whitespace-nowrap">{r.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="text-[10px] text-text-dim mt-2.5 leading-relaxed">
            Spreads OAS vía ICE BofA Indices (FRED). Global IG/HY, US Munis, Canada IG, Europe IG no disponibles sin Bloomberg — no incluidos.
          </div>
        </>
      )}
    </div>
  );
}
