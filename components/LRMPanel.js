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
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [editingCal, setEditingCal] = useState(false);
  const [newEntry, setNewEntry] = useState({ fecha: "", instrumento: "", plazo: "", monto: "" });

  useEffect(() => {
    fetch("/api/lrm").then((r) => r.json()).then(setLrm).catch(() => {});
    fetch("/api/bcu-calendar").then((r) => r.json()).then((data) => {
      if (Array.isArray(data)) setCalendar(data);
      else setCalendar([]);
    }).catch(() => setCalendar([]));
  }, []);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch("/api/lrm", { method: "POST", body: form });
      const data = await res.json();
      if (data.error) {
        setUploadError(data.error);
      } else {
        setLrm(data);
      }
    } catch (err) {
      setUploadError(err.message);
    }
    setUploading(false);
    e.target.value = "";
  };

  const addCalendarEntry = async () => {
    if (!newEntry.fecha || !newEntry.instrumento) return;
    const updated = [...(calendar || []), { ...newEntry }];
    setCalendar(updated);
    setNewEntry({ fecha: "", instrumento: "", plazo: "", monto: "" });
    setEditingCal(false);
    try {
      await fetch("/api/bcu-calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      });
    } catch {}
  };

  const removeCalendarEntry = async (index) => {
    const updated = calendar.filter((_, i) => i !== index);
    setCalendar(updated);
    try {
      await fetch("/api/bcu-calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      });
    } catch {}
  };

  const curve = lrm?.curve?.filter((d) => d.rate !== null) || [];
  const chartData = curve.map((d) => ({ mat: d.label, rate: d.rate }));

  const rates = chartData.map((d) => d.rate);
  const minRate = rates.length ? Math.floor(Math.min(...rates) * 10) / 10 - 0.5 : 0;
  const maxRate = rates.length ? Math.ceil(Math.max(...rates) * 10) / 10 + 0.5 : 10;

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex justify-between items-center mb-3">
        <span className="text-xs font-semibold text-white">Letras de Regulación Monetaria (LRM)</span>
        <label className="cursor-pointer bg-accent hover:bg-accent/80 text-white text-[10px] font-semibold px-3 py-1.5 rounded-md transition">
          {uploading ? "Subiendo..." : "Actualizar LRM"}
          <input type="file" accept=".xlsx,.xls" onChange={handleUpload} className="hidden" />
        </label>
      </div>

      {uploadError && (
        <div className="text-[11px] text-red-400 mb-2">Error: {uploadError}</div>
      )}
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
          Subí el Excel de LRM para ver la curva de rendimiento
        </div>
      )}

      {/* BCU Calendar */}
      <div className="mt-4 border-t border-border pt-3">
        <div className="flex justify-between items-center mb-2">
          <span className="text-[11px] font-semibold text-white">Calendario de Licitaciones BCU</span>
          <button
            onClick={() => setEditingCal(!editingCal)}
            className="text-[10px] text-accent hover:text-accent/80 font-medium"
          >
            {editingCal ? "Cancelar" : "+ Agregar"}
          </button>
        </div>
        {editingCal && (
          <div className="flex gap-1.5 mb-2">
            <input
              type="text"
              placeholder="Fecha (ej: 19/3/2026)"
              value={newEntry.fecha}
              onChange={(e) => setNewEntry({ ...newEntry, fecha: e.target.value })}
              className="bg-bg border border-border rounded px-2 py-1 text-[10px] text-white w-[110px]"
            />
            <input
              type="text"
              placeholder="Instrumento"
              value={newEntry.instrumento}
              onChange={(e) => setNewEntry({ ...newEntry, instrumento: e.target.value })}
              className="bg-bg border border-border rounded px-2 py-1 text-[10px] text-white flex-1"
            />
            <input
              type="text"
              placeholder="Plazo"
              value={newEntry.plazo}
              onChange={(e) => setNewEntry({ ...newEntry, plazo: e.target.value })}
              className="bg-bg border border-border rounded px-2 py-1 text-[10px] text-white w-[50px]"
            />
            <input
              type="text"
              placeholder="Monto"
              value={newEntry.monto}
              onChange={(e) => setNewEntry({ ...newEntry, monto: e.target.value })}
              className="bg-bg border border-border rounded px-2 py-1 text-[10px] text-white w-[70px]"
            />
            <button
              onClick={addCalendarEntry}
              className="bg-accent text-white text-[10px] font-semibold px-2 py-1 rounded hover:bg-accent/80"
            >
              OK
            </button>
          </div>
        )}
        {calendar && calendar.length > 0 ? (
          <table className="w-full">
            <thead>
              <tr style={{ backgroundColor: "#0d0d1a" }}>
                <th className="px-2 py-1.5 text-left text-[10px] font-bold text-white uppercase">Fecha</th>
                <th className="px-2 py-1.5 text-left text-[10px] font-bold text-white uppercase">Instrumento</th>
                <th className="px-2 py-1.5 text-center text-[10px] font-bold text-white uppercase">Plazo</th>
                <th className="px-2 py-1.5 text-right text-[10px] font-bold text-white uppercase">Monto (M)</th>
                <th className="px-1 py-1.5 w-6"></th>
              </tr>
            </thead>
            <tbody>
              {calendar.map((item, i) => (
                <tr key={i} className={`border-b border-border ${i % 2 === 0 ? "" : "bg-white/[0.01]"}`}>
                  <td className="px-2 py-1.5 text-[11px] text-white font-mono">{item.fecha}</td>
                  <td className="px-2 py-1.5 text-[11px] text-text-primary">{item.instrumento}</td>
                  <td className="px-2 py-1.5 text-center text-[11px] text-text-dim font-mono">{item.plazo}d</td>
                  <td className="px-2 py-1.5 text-right text-[11px] text-white font-mono">{item.monto}</td>
                  <td className="px-1 py-1.5 text-center">
                    <button
                      onClick={() => removeCalendarEntry(i)}
                      className="text-[10px] text-text-dim hover:text-red-400"
                    >x</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : calendar && calendar.length === 0 ? (
          <div className="text-[11px] text-text-dim">No hay licitaciones. Usá "+ Agregar" para cargar.</div>
        ) : (
          <div className="text-[11px] text-text-dim">Cargando calendario...</div>
        )}
      </div>
    </div>
  );
}
