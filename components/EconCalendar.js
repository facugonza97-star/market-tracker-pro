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
      <span className="text-[20px] font-semibold text-white block mb-4">
        📅 Calendario Económico USA
      </span>
      {events && events.length > 0 ? (
        <table className="w-full">
          <thead>
            <tr style={{ backgroundColor: "#0d0d1a" }}>
              <th className="px-3 py-2.5 text-left text-xs font-bold text-white uppercase tracking-wide">Fecha</th>
              <th className="px-3 py-2.5 text-left text-xs font-bold text-white uppercase tracking-wide">Evento</th>
              <th className="px-3 py-2.5 text-right text-xs font-bold text-white uppercase tracking-wide">Estimado</th>
              <th className="px-3 py-2.5 text-right text-xs font-bold text-white uppercase tracking-wide">Anterior</th>
              <th className="px-3 py-2.5 text-right text-xs font-bold text-white uppercase tracking-wide">Actual</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e, i) => {
              const hasActual = e.actual !== null && e.actual !== undefined;
              const beatEstimate = hasActual && e.estimate != null && e.actual >= e.estimate;
              return (
                <tr key={i} className={`border-b border-border ${i % 2 === 0 ? "" : "bg-white/[0.01]"}`}>
                  <td className="px-3 py-2 text-xs text-white font-mono">{fmtDate(e.date)}</td>
                  <td className="px-3 py-2 text-xs text-white">{e.event}</td>
                  <td className="px-3 py-2 text-right text-xs text-text-dim font-mono">{fmtVal(e.estimate)}</td>
                  <td className="px-3 py-2 text-right text-xs text-text-dim font-mono">{fmtVal(e.previous)}</td>
                  <td className={`px-3 py-2 text-right text-xs font-semibold font-mono ${
                    hasActual ? (beatEstimate ? "text-pos" : "text-neg") : "text-text-dim"
                  }`}>
                    {hasActual ? fmtVal(e.actual) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : events && events.length === 0 ? (
        <div className="text-xs text-text-dim">No hay eventos de alta importancia próximos.</div>
      ) : (
        <div className="text-xs text-text-dim">Cargando calendario...</div>
      )}
    </div>
  );
}
