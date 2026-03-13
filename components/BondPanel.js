"use client";
import { useState, useEffect, useRef } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from "recharts";

const SECTION_CONFIG = {
  "Uruguay USD": { label: "\u{1F1FA}\u{1F1FE} Uruguay USD", color: "#5B8DEF" },
  "Uruguay Pesos": { label: "\u{1F1FA}\u{1F1FE} Uruguay Pesos", color: "#5B8DEF" },
  "Notas UI": { label: "\u{1F1FA}\u{1F1FE} Notas UI", color: "#5B8DEF" },
  "Notas Pesos": { label: "\u{1F1FA}\u{1F1FE} Notas Pesos", color: "#5B8DEF" },
  "US Treasuries": { label: "\u{1F1FA}\u{1F1F8} US Treasuries", color: "#34D399" },
  "US TIPS": { label: "\u{1F1FA}\u{1F1F8} US TIPS", color: "#34D399" },
  "T-bills": { label: "\u{1F1FA}\u{1F1F8} T-bills", color: "#34D399" },
  "Strips": { label: "\u{1F1FA}\u{1F1F8} Strips", color: "#34D399" },
  "PEMEX": { label: "\u{1F1F2}\u{1F1FD} PEMEX", color: "#F59E0B" },
  "Petrobras": { label: "\u{1F1E7}\u{1F1F7} Petrobras", color: "#FBBF24" },
  "Brasil": { label: "\u{1F1E7}\u{1F1F7} Brasil", color: "#FBBF24" },
  "Ecopetrol": { label: "\u{1F1E8}\u{1F1F4} Ecopetrol", color: "#EF4444" },
  "Panama": { label: "\u{1F1F5}\u{1F1E6} Panama", color: "#A78BFA" },
};

function BondTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{
      background: "#0F1520",
      border: "1px solid #2A3A50",
      borderRadius: 8,
      padding: "8px 12px",
    }}>
      <div style={{ color: "#94A3B8", fontSize: 11, marginBottom: 4 }}>Vencimiento: {d.vencimiento}</div>
      {d.cupon !== null && <div style={{ color: "#CBD5E0", fontSize: 12 }}>Cupon: {d.cupon.toFixed(3)}%</div>}
      <div style={{ color: "#CBD5E0", fontSize: 12 }}>Precio: {d.precio?.toFixed(2) ?? "\u2014"}</div>
      <div style={{ color: "#ffffff", fontSize: 14, fontWeight: 600, fontFamily: "monospace" }}>
        TIR: {d.tir.toFixed(2)}%
      </div>
    </div>
  );
}

export default function BondPanel() {
  const [sections, setSections] = useState(null);
  const [active, setActive] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [source, setSource] = useState(null);
  const [error, setError] = useState(null);
  const fileRef = useRef(null);

  // Load from Google Sheets on mount as fallback
  useEffect(() => {
    fetch("/api/bonos")
      .then((r) => r.json())
      .then((data) => {
        setSections(data);
        setSource("sheets");
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    console.log("[BondPanel] handleUpload triggered, file:", file ? `${file.name} (${file.size} bytes, ${file.type})` : "NONE");
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      console.log("[BondPanel] Sending POST to /api/parse-bonds...");
      const res = await fetch("/api/parse-bonds", { method: "POST", body: formData });
      console.log("[BondPanel] Response status:", res.status);
      if (!res.ok) {
        const errBody = await res.text();
        console.error("[BondPanel] Server error response:", errBody);
        throw new Error(errBody || `Server error ${res.status}`);
      }
      const result = await res.json();
      console.log("[BondPanel] Sections received:", Object.keys(result));
      setSections(result);
      setSource("excel");
      setActive(null);
    } catch (err) {
      console.error("[BondPanel] Upload failed:", err.message, err);
      setError(err.message || "Error al procesar el Excel");
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const sectionKeys = sections ? Object.keys(sections).filter((k) => sections[k].length > 0) : [];
  const activeData = active && sections?.[active] ? sections[active] : null;
  const activeConfig = active ? SECTION_CONFIG[active] : null;

  const rates = activeData?.map((d) => d.tir) || [];
  const minRate = rates.length ? Math.floor(Math.min(...rates) * 10) / 10 - 0.3 : 0;
  const maxRate = rates.length ? Math.ceil(Math.max(...rates) * 10) / 10 + 0.5 : 10;

  return (
    <div className="px-6 py-5 space-y-5">
      {/* Header with upload */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-[20px] font-semibold text-white">Bonos</span>
          {source && (
            <span className="text-[11px] text-text-dim ml-3">
              {source === "excel" ? "Datos del Excel" : "Datos de Google Sheets"}
            </span>
          )}
        </div>
        <label className={`bg-accent text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-accent/80 transition cursor-pointer ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
          {uploading ? "Procesando..." : "\u{1F4CA} Subir Excel de Bonos"}
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleUpload}
            disabled={uploading}
          />
        </label>
      </div>

      {error && (
        <div className="text-center text-neg text-sm py-2">{error}</div>
      )}

      {loading && (
        <div className="text-center text-text-sec text-sm py-10">Cargando datos de bonos...</div>
      )}

      {/* Issuer buttons */}
      {sectionKeys.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {sectionKeys.map((key) => {
            const cfg = SECTION_CONFIG[key] || { label: key, color: "#5B8DEF" };
            const isActive = active === key;
            return (
              <button
                key={key}
                onClick={() => setActive(isActive ? null : key)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition border ${
                  isActive
                    ? "bg-white/10 border-white/30 text-white"
                    : "bg-card border-border text-text-sec hover:text-white hover:border-white/20"
                }`}
              >
                {cfg.label}
                <span className="ml-1.5 text-xs text-text-dim">({sections[key].length})</span>
              </button>
            );
          })}
        </div>
      )}

      {!loading && sectionKeys.length === 0 && (
        <div className="flex items-center justify-center h-40">
          <div className="text-text-sec text-sm">No hay datos de bonos disponibles.</div>
        </div>
      )}

      {/* Chart + Table for active section */}
      {activeData && activeConfig && (
        <div className="space-y-5">
          {/* Chart */}
          <div className="bg-card border border-border rounded-xl p-5">
            <span className="text-[18px] font-semibold text-white block mb-4">
              {activeConfig.label} — Curva de Rendimiento
            </span>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={activeData} margin={{ top: 25, right: 15, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="bondGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={activeConfig.color} stopOpacity={0.15} />
                    <stop offset="95%" stopColor={activeConfig.color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E2D40" vertical={false} />
                <XAxis
                  dataKey="year"
                  tick={{ fill: "#94A3B8", fontSize: 12 }}
                  tickLine={false}
                  axisLine={{ stroke: "#1E2D40" }}
                />
                <YAxis
                  domain={[minRate, maxRate]}
                  tick={{ fill: "#94A3B8", fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => v.toFixed(1) + "%"}
                  width={50}
                />
                <Tooltip content={<BondTooltip />} cursor={{ stroke: activeConfig.color, strokeOpacity: 0.3 }} />
                <Area
                  type="monotone"
                  dataKey="tir"
                  stroke={activeConfig.color}
                  strokeWidth={2}
                  fill="url(#bondGrad)"
                  dot={{ r: 4, fill: activeConfig.color, strokeWidth: 0 }}
                  activeDot={{ r: 6, fill: activeConfig.color, stroke: "#ffffff", strokeWidth: 2 }}
                >
                  <LabelList
                    dataKey="tir"
                    position="top"
                    offset={10}
                    formatter={(v) => v.toFixed(2) + "%"}
                    style={{ fontSize: 11, fill: "#FFFFFF", fontWeight: 600 }}
                  />
                </Area>
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Table */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr style={{ backgroundColor: "#0d0d1a" }}>
                  <th className="px-3 py-2.5 text-left text-xs font-bold text-[#94A3B8] uppercase tracking-wide">Cupon</th>
                  <th className="px-3 py-2.5 text-left text-xs font-bold text-[#94A3B8] uppercase tracking-wide">Vencimiento</th>
                  <th className="px-3 py-2.5 text-right text-xs font-bold text-[#94A3B8] uppercase tracking-wide">Precio</th>
                  <th className="px-3 py-2.5 text-right text-xs font-bold text-[#94A3B8] uppercase tracking-wide">TIR</th>
                </tr>
              </thead>
              <tbody>
                {activeData.map((b, i) => (
                  <tr key={i} className={`border-b border-border ${i % 2 === 0 ? "" : "bg-white/[0.01]"}`}>
                    <td className="px-3 py-2 text-sm text-white font-mono">{b.cupon !== null ? b.cupon.toFixed(3) + "%" : "\u2014"}</td>
                    <td className="px-3 py-2 text-sm text-white">{b.vencimiento}</td>
                    <td className="px-3 py-2 text-right text-sm text-white font-mono">{b.precio?.toFixed(2) ?? "\u2014"}</td>
                    <td className="px-3 py-2 text-right text-sm font-semibold font-mono" style={{ color: activeConfig.color }}>
                      {b.tir.toFixed(2)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
