"use client";
import { useState, useEffect } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from "recharts";

function CustomLabel({ x, y, value }) {
  if (value === null || value === undefined) return null;
  return (
    <text x={x} y={y - 10} fill="#ffffff" fontSize={9} fontWeight="bold" textAnchor="middle">
      {value.toFixed(2)}%
    </text>
  );
}

export default function LRMPanel() {
  const [lrm, setLrm] = useState(null);
  const [calendar, setCalendar] = useState(null);

  useEffect(() => {
    fetch("/api/lrm").then((r) => r.json()).then(setLrm).catch(() => {});
    fetch("/api/bcu-calendar").then((r) => r.json()).then((data) => {
      if (Array.isArray(data)) setCalendar(data);
      else setCalendar([]);
    }).catch(() => setCalendar([]));
  }, []);

  const curve = lrm?.curve?.filter((d) => d.rate !== null) || [];
  const chartData = curve.map((d) => ({ mat: d.label, rate: d.rate }));

  const rates = chartData.map((d) => d.rate);
  const minRate = rates.length ? Math.floor(Math.min(...rates) * 10) / 10 - 0.5 : 0;
  const maxRate = rates.length ? Math.ceil(Math.max(...rates) * 10) / 10 + 0.5 : 10;

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex justify-between items-center mb-4">
        <span className="text-[20px] font-semibold text-white">🇺🇾 Letras de Regulación Monetaria (LRM)</span>
      </div>

      {chartData.length > 0 ? (
        <>
          <ResponsiveContainer width="100%" height={200} >
            <AreaChart data={chartData} margin={{ top: 20, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="lrmGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1C2536" />
              <XAxis
                dataKey="mat"
                tick={{ fill: "#ffffff", fontSize: 10, fontWeight: "bold" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={[minRate, maxRate]}
                tick={{ fill: "#ffffff", fontSize: 10, fontWeight: "bold" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => v.toFixed(1) + "%"}
                width={45}
              />
              <Tooltip
                contentStyle={{
                  background: "#0F1520",
                  border: "1px solid #1C2536",
                  borderRadius: 6,
                  fontSize: 12,
                }}
                formatter={(v) => [v.toFixed(2) + "%", "Tasa"]}
              />
              <Area
                type="monotone"
                dataKey="rate"
                stroke="#F59E0B"
                strokeWidth={2}
                fill="url(#lrmGrad)"
                dot={{ r: 3, fill: "#F59E0B", strokeWidth: 0 }}
                activeDot={{ r: 6 }}
              >
                <LabelList dataKey="rate" content={<CustomLabel />} />
              </Area>
            </AreaChart>
          </ResponsiveContainer>
          {lrm?.updatedAt && (
            <div className="text-[9px] text-text-dim text-right mt-1">
              Datos actualizados: {new Date(lrm.updatedAt).toLocaleDateString("es-UY")}
            </div>
          )}
        </>
      ) : (
        <div className="flex items-center justify-center h-[200px] text-text-dim text-sm">
          No hay datos de LRM disponibles
        </div>
      )}

      {/* BCU Calendar */}
      <div className="mt-5 border-t border-border pt-4">
        <div className="flex justify-between items-center mb-3">
          <span className="text-[20px] font-semibold text-white">Calendario de Licitaciones BCU</span>
        </div>
        {calendar && calendar.length > 0 ? (
          <table className="w-full">
            <thead>
              <tr style={{ backgroundColor: "#0d0d1a" }}>
                <th className="px-3 py-2.5 text-left text-xs font-bold text-white uppercase tracking-wide">Fecha Lic.</th>
                <th className="px-3 py-2.5 text-left text-xs font-bold text-white uppercase tracking-wide">Fecha Venc.</th>
                <th className="px-3 py-2.5 text-center text-xs font-bold text-white uppercase tracking-wide">Plazo</th>
              </tr>
            </thead>
            <tbody>
              {calendar.map((item, i) => (
                <tr key={i} className={`border-b border-border ${i % 2 === 0 ? "" : "bg-white/[0.01]"}`}>
                  <td className="px-3 py-2 text-xs text-white font-mono">{item.fechaLicitacion}</td>
                  <td className="px-3 py-2 text-xs text-white font-mono">{item.fechaVencimiento}</td>
                  <td className="px-3 py-2 text-center text-xs text-white font-mono">{item.plazo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : calendar && calendar.length === 0 ? (
          <div className="text-xs text-text-dim">No hay licitaciones programadas.</div>
        ) : (
          <div className="text-xs text-text-dim">Cargando calendario...</div>
        )}
      </div>
    </div>
  );
}
