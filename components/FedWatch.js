"use client";
import { useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

const ACCENT = "#5B8DEF";
const AMBER = "#F8A11E";
const GRAY2 = "#5a6478";
const GRAY3 = "#3f4759";

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  if (d.isToday) {
    return (
      <div style={{ background: "#0F1520", border: "1px solid #2A3A50", borderRadius: 8, padding: "8px 12px", fontFamily: "'Source Code Pro',monospace" }}>
        <div style={{ color: "#94A3B8", fontSize: 11, marginBottom: 4 }}>Rango actual</div>
        <div style={{ color: ACCENT, fontSize: 14, fontWeight: 600 }}>{d.p1r}: 100%</div>
      </div>
    );
  }
  const rows = [
    { c: AMBER, r: d.p1r, v: d.p1 },
    { c: GRAY2, r: d.p2r, v: d.p2 },
    { c: GRAY3, r: d.p3r, v: d.p3 },
  ].filter((x) => x.v != null);
  return (
    <div style={{ background: "#0F1520", border: "1px solid #2A3A50", borderRadius: 8, padding: "8px 12px", fontFamily: "'Source Code Pro',monospace" }}>
      <div style={{ color: "#94A3B8", fontSize: 11, marginBottom: 4 }}>{d.fullDate}{d.low ? " · liquidez baja" : ""}</div>
      {rows.map((x, i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 14, marginTop: i > 0 ? 3 : 0 }}>
          <span style={{ color: x.c, fontSize: 13 }}>{x.r}</span>
          <span style={{ color: "#fff", fontSize: 13, fontWeight: 600 }}>{x.v.toFixed(1)}%</span>
        </div>
      ))}
    </div>
  );
}

function tick(props) {
  const { x, y, payload } = props;
  const low = payload.value.endsWith("†");
  return (
    <text x={x} y={y + 10} textAnchor="middle" fontSize={10} fill="#94A3B8" fontFamily="'Source Code Pro',monospace">
      {payload.value}
    </text>
  );
}

export default function FedWatch() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/fedwatch")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d && Array.isArray(d.meetings) && d.currentRange) setData(d);
        else setError(true);
      })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, []);

  const chartData =
    data && data.currentRange
      ? [
          { x: "Hoy", isToday: true, p1: 100, p1r: data.currentRange.label },
          ...data.meetings.map((m) => ({
            x: m.label + (m.lowLiquidity ? "†" : ""),
            fullDate: m.label,
            low: m.lowLiquidity,
            p1: m.ranges[0]?.prob ?? null, p1r: m.ranges[0]?.label ?? "",
            p2: m.ranges[1]?.prob ?? null, p2r: m.ranges[1]?.label ?? "",
            p3: m.ranges[2]?.prob ?? null, p3r: m.ranges[2]?.label ?? "",
          })),
        ]
      : [];

  const anyLow = data?.meetings?.some((m) => m.lowLiquidity);

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center gap-2.5 mb-4">
        <span className="w-[3px] h-3.5 rounded-full bg-accent" />
        <span className="text-[13px] font-bold text-accent uppercase tracking-[0.15em]">
          Fed Funds Futures — Probabilidad Implícita
        </span>
      </div>

      {data === null && !error ? (
        <div className="text-xs text-text-dim h-64 flex items-center justify-center">Cargando probabilidades...</div>
      ) : error && data === null ? (
        <div className="text-xs text-text-dim h-64 flex items-center justify-center">No se pudieron cargar las probabilidades.</div>
      ) : (
        <>
          <div style={{ background: "#000000", borderRadius: 8, padding: "8px 4px" }}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData} margin={{ top: 12, right: 12, left: 0, bottom: 0 }} barCategoryGap="22%" barGap={2}>
                <CartesianGrid strokeDasharray="2 2" stroke="#FFFFFF" strokeOpacity={0.12} vertical={false} />
                <XAxis dataKey="x" tick={tick} tickLine={false} axisLine={{ stroke: "#1E2D40" }} interval={0} />
                <YAxis domain={[0, 100]} tick={{ fill: "#94A3B8", fontSize: 11, fontFamily: "'Source Code Pro',monospace" }} tickLine={false} axisLine={false} tickFormatter={(v) => v + "%"} width={40} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                <Bar dataKey="p1" radius={[2, 2, 0, 0]}>
                  {chartData.map((d, i) => (
                    <Cell key={i} fill={d.isToday ? ACCENT : AMBER} />
                  ))}
                </Bar>
                <Bar dataKey="p2" fill={GRAY2} radius={[2, 2, 0, 0]} />
                <Bar dataKey="p3" fill={GRAY3} radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Custom legend */}
          <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-3 text-[11px] font-mono">
            <span className="flex items-center gap-1.5 text-text-sec"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: ACCENT }} />Rango actual</span>
            <span className="flex items-center gap-1.5 text-text-sec"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: AMBER }} />Más probable</span>
            <span className="flex items-center gap-1.5 text-text-sec"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: GRAY2 }} />Otros rangos</span>
            {anyLow && <span className="text-text-dim">† liquidez baja, dato menos confiable</span>}
          </div>

          <div className="text-[10px] text-text-dim mt-2.5 leading-relaxed">
            Probabilidades calculadas a partir de 30-Day Fed Funds Futures (Yahoo Finance) y tasa efectiva (FRED),
            replicando la metodología pública de CME FedWatch — no son datos oficiales de CME ni garantía de resultado.
          </div>
        </>
      )}
    </div>
  );
}
