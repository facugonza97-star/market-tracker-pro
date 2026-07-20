"use client";
import { useState, useEffect } from "react";

function fmtDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function fmtVal(v) {
  if (v === null || v === undefined) return "—";
  return typeof v === "number" ? v.toFixed(2) : String(v);
}

export default function EconCalendar() {
  const [events, setEvents] = useState(null);

  useEffect(() => {
    fetch("/api/econ-calendar")
      .then((r) => r.json())
      .then((data) => setEvents(Array.isArray(data) ? data : []))
      .catch(() => setEvents([]));
  }, []);

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center gap-2.5 mb-4">
        <span className="w-[3px] h-3.5 rounded-full bg-accent" />
        <span className="text-[13px] font-bold text-accent uppercase tracking-[0.15em]">Calendario Económico USA</span>
      </div>
      {events && events.length > 0 ? (
        <div className="rounded-md overflow-hidden border border-border">
        <table className="w-full" style={{ background: "#000000" }}>
          <thead>
            <tr style={{ backgroundColor: "#0d0d1a" }}>
              <th className="px-3 py-2.5 text-left text-[11px] font-bold text-[#94A3B8] uppercase tracking-wide border-r border-white/10">Fecha</th>
              <th className="px-3 py-2.5 text-left text-[11px] font-bold text-[#94A3B8] uppercase tracking-wide border-r border-white/10">Evento</th>
              <th className="px-3 py-2.5 text-right text-[11px] font-bold text-[#94A3B8] uppercase tracking-wide border-r border-white/10">Estimado</th>
              <th className="px-3 py-2.5 text-right text-[11px] font-bold text-[#94A3B8] uppercase tracking-wide border-r border-white/10">Anterior</th>
              <th className="px-3 py-2.5 text-right text-[11px] font-bold text-[#94A3B8] uppercase tracking-wide">Actual</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e, i) => {
              const hasActual = e.actual !== null && e.actual !== undefined;
              const beatEstimate = hasActual && e.estimate != null && e.actual >= e.estimate;
              return (
                <tr key={i} className="border-b border-white/5 hover:bg-[#1a2f52]">
                  <td className="px-3 py-1.5 text-xs text-white font-mono border-r border-white/5">{fmtDate(e.date)}</td>
                  <td className="px-3 py-1.5 text-xs text-price border-r border-white/5">{e.event}</td>
                  <td className="px-3 py-1.5 text-right text-xs text-white font-mono border-r border-white/5">{fmtVal(e.estimate)}</td>
                  <td className="px-3 py-1.5 text-right text-xs text-white font-mono border-r border-white/5">{fmtVal(e.previous)}</td>
                  <td className={`px-3 py-1.5 text-right text-xs font-semibold font-mono ${
                    hasActual ? (beatEstimate ? "text-pos" : "text-neg") : "text-text-dim"
                  }`}>
                    {hasActual ? fmtVal(e.actual) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      ) : events && events.length === 0 ? (
        <div className="text-xs text-text-dim">No hay eventos de alta importancia próximos.</div>
      ) : (
        <div className="text-xs text-text-dim">Cargando calendario...</div>
      )}
    </div>
  );
}
