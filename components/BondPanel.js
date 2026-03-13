"use client";
import { useState, useEffect, useRef } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

const SECTION_CONFIG = {
  "Uruguay USD": { label: "\u{1F1FA}\u{1F1FE} Uruguay USD", color: "#5B8DEF" },
  "Uruguay Pesos": { label: "\u{1F1FA}\u{1F1FE} Uruguay Pesos", color: "#38BDF8" },
  "Notas UI": { label: "\u{1F1FA}\u{1F1FE} Notas UI", color: "#A78BFA" },
  "Notas Pesos": { label: "\u{1F1FA}\u{1F1FE} Notas Pesos", color: "#F472B6" },
  "US Treasuries": { label: "\u{1F1FA}\u{1F1F8} US Treasuries", color: "#48BB78" },
  "US TIPS": { label: "\u{1F1FA}\u{1F1F8} US TIPS", color: "#86EFAC" },
  "T-bills": { label: "\u{1F1FA}\u{1F1F8} T-bills", color: "#34D399" },
  "Strips": { label: "\u{1F1FA}\u{1F1F8} Strips", color: "#2DD4BF" },
  "PEMEX": { label: "\u{1F1F2}\u{1F1FD} PEMEX", color: "#FB923C" },
  "Petrobras": { label: "\u{1F1E7}\u{1F1F7} Petrobras", color: "#FBBF24" },
  "Brasil": { label: "\u{1F1E7}\u{1F1F7} Brasil", color: "#F59E0B" },
  "Ecopetrol": { label: "\u{1F1E8}\u{1F1F4} Ecopetrol", color: "#F87171" },
  "Panama": { label: "\u{1F1F5}\u{1F1E6} Panama", color: "#C084FC" },
};

// --- TIR Calculator (ICMA Actual/Actual, semiannual coupons) ---

function parseFecha(str) {
  if (!str) return null;
  const parts = str.trim().split("/");
  if (parts.length !== 3) return null;
  const d = parseInt(parts[0]);
  const m = parseInt(parts[1]) - 1;
  const y = parseInt(parts[2]);
  if (isNaN(d) || isNaN(m) || isNaN(y)) return null;
  return new Date(y, m, d);
}

function getCouponDates(vencimiento, cuponAnual) {
  if (!vencimiento || cuponAnual === null || cuponAnual === 0) return [];
  const today = new Date();
  const dates = [];
  let d = new Date(vencimiento);
  while (d > today) {
    dates.unshift(new Date(d));
    d.setMonth(d.getMonth() - 6);
  }
  return dates;
}

function calcularTIR(precioLimpio, cuponAnual, vencimientoStr) {
  const venc = parseFecha(vencimientoStr);
  if (!venc || precioLimpio === null || precioLimpio <= 0) return null;
  if (cuponAnual === null || cuponAnual === 0) {
    // Zero coupon: TIR = (100/P)^(1/t) - 1
    const today = new Date();
    const t = (venc - today) / (365.25 * 86400000);
    if (t <= 0) return null;
    return (Math.pow(100 / precioLimpio, 1 / t) - 1) * 100;
  }

  const couponDates = getCouponDates(venc, cuponAnual);
  if (couponDates.length === 0) return null;

  const semiCoupon = cuponAnual / 2;
  const today = new Date();

  function pvAtRate(r) {
    const semi = r / 2;
    let pv = 0;
    for (let i = 0; i < couponDates.length; i++) {
      const t = (couponDates[i] - today) / (365.25 * 86400000 / 2); // periods
      const cf = i === couponDates.length - 1 ? semiCoupon + 100 : semiCoupon;
      pv += cf / Math.pow(1 + semi, t);
    }
    return pv;
  }

  // Bisection method
  let lo = -0.05, hi = 1.0;
  for (let iter = 0; iter < 200; iter++) {
    const mid = (lo + hi) / 2;
    const pv = pvAtRate(mid);
    if (Math.abs(pv - precioLimpio) < 0.0001) return mid * 100;
    if (pv > precioLimpio) lo = mid;
    else hi = mid;
  }
  return ((lo + hi) / 2) * 100;
}

// --- TIR Modal ---

function TIRModal({ bond, onClose }) {
  const [precio, setPrecio] = useState(bond.precio !== null ? bond.precio.toString() : "");
  const precioNum = parseFloat(precio.replace(",", "."));
  const tirResult = !isNaN(precioNum) && precioNum > 0
    ? calcularTIR(precioNum, bond.cupon, bond.vencimiento)
    : null;

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.6)", display: "flex",
        alignItems: "center", justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#0F1520", border: "1px solid #2A3A50",
          borderRadius: 12, padding: "24px 28px", minWidth: 320, maxWidth: 400,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ color: "#94A3B8", fontSize: 12, marginBottom: 4 }}>Calculadora TIR</div>
        <div style={{ color: "#fff", fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
          {bond.cupon !== null ? `Cupón ${bond.cupon.toFixed(3)}%` : "Zero Coupon"} — Venc. {bond.vencimiento}
        </div>

        <label style={{ color: "#94A3B8", fontSize: 12 }}>Precio limpio</label>
        <input
          type="text"
          value={precio}
          onChange={(e) => setPrecio(e.target.value)}
          placeholder="Ej: 95.50"
          autoFocus
          style={{
            display: "block", width: "100%", marginTop: 4, marginBottom: 16,
            background: "#1A2332", border: "1px solid #2A3A50", borderRadius: 8,
            padding: "8px 12px", color: "#fff", fontSize: 16, fontFamily: "monospace",
            outline: "none",
          }}
        />

        <div style={{
          background: "#1A2332", borderRadius: 8, padding: "12px 16px",
          marginBottom: 16, textAlign: "center",
        }}>
          <div style={{ color: "#94A3B8", fontSize: 11, marginBottom: 4 }}>TIR (ICMA Actual/Actual)</div>
          <div style={{ color: "#fff", fontSize: 28, fontWeight: 700, fontFamily: "monospace" }}>
            {tirResult !== null ? tirResult.toFixed(3) + "%" : "\u2014"}
          </div>
        </div>

        <button
          onClick={onClose}
          style={{
            width: "100%", padding: "8px 0", background: "#2A3A50",
            border: "none", borderRadius: 8, color: "#CBD5E0",
            fontSize: 14, fontWeight: 600, cursor: "pointer",
          }}
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}

// --- Tooltips ---

function CompareTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "#0F1520",
      border: "1px solid #2A3A50",
      borderRadius: 8,
      padding: "8px 12px",
    }}>
      {payload.map((p, i) => (
        <div key={i} style={{ marginBottom: i < payload.length - 1 ? 6 : 0 }}>
          <div style={{ color: p.color, fontSize: 12, fontWeight: 600 }}>{p.name}</div>
          <div style={{ color: "#ffffff", fontSize: 14, fontWeight: 600, fontFamily: "monospace" }}>
            {p.value != null ? p.value.toFixed(2) + "%" : "\u2014"}
          </div>
        </div>
      ))}
      {payload[0]?.payload?.year && (
        <div style={{ color: "#94A3B8", fontSize: 11, marginTop: 4 }}>{payload[0].payload.year}</div>
      )}
    </div>
  );
}

function SingleTooltip({ active, payload }) {
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

// --- Main Component ---

export default function BondPanel() {
  const [sections, setSections] = useState(null);
  const [active, setActive] = useState(null);
  const [compare, setCompare] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [source, setSource] = useState(null);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [tirBond, setTirBond] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    fetch("/api/bonos-timestamp")
      .then((r) => r.json())
      .then((data) => { if (data.lastUpdate) setLastUpdate(data.lastUpdate); })
      .catch(() => {});
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
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/parse-bonds", { method: "POST", body: formData });
      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(errBody || `Server error ${res.status}`);
      }
      const result = await res.json();
      setSections(result);
      setSource("excel");
      setActive(null);
      setCompare(null);
      // Refresh timestamp
      fetch("/api/bonos-timestamp").then((r) => r.json()).then((d) => { if (d.lastUpdate) setLastUpdate(d.lastUpdate); }).catch(() => {});
    } catch (err) {
      setError(err.message || "Error al procesar el Excel");
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const sectionKeys = sections ? Object.keys(sections).filter((k) => sections[k].length > 0) : [];
  const activeData = active && sections?.[active] ? sections[active] : null;
  const activeConfig = active ? SECTION_CONFIG[active] : null;
  const compareData = compare && sections?.[compare] ? sections[compare] : null;
  const compareConfig = compare ? SECTION_CONFIG[compare] : null;

  // Build merged chart data for comparison
  const isComparing = activeData && compareData && compare !== active;
  let chartData, allRates;

  if (isComparing) {
    const yearMap = {};
    for (const b of activeData) {
      if (!yearMap[b.year]) yearMap[b.year] = { year: b.year };
      yearMap[b.year].tir1 = b.tir;
    }
    for (const b of compareData) {
      if (!yearMap[b.year]) yearMap[b.year] = { year: b.year };
      yearMap[b.year].tir2 = b.tir;
    }
    chartData = Object.values(yearMap).sort((a, b) => a.year - b.year);
    allRates = chartData.flatMap((d) => [d.tir1, d.tir2]).filter((v) => v != null);
  } else if (activeData) {
    chartData = activeData;
    allRates = activeData.map((d) => d.tir);
  } else {
    chartData = [];
    allRates = [];
  }

  const minRate = allRates.length ? Math.floor(Math.min(...allRates) * 10) / 10 - 0.3 : 0;
  const maxRate = allRates.length ? Math.ceil(Math.max(...allRates) * 10) / 10 + 0.5 : 10;

  return (
    <div className="px-6 py-5 space-y-5">
      {/* TIR Calculator Modal */}
      {tirBond && <TIRModal bond={tirBond} onClose={() => setTirBond(null)} />}

      {/* Header with upload */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-[20px] font-semibold text-white">Bonos</span>
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

      {lastUpdate && (
        <div className="text-sm text-white">
          Última actualización precios bonos: {lastUpdate}
        </div>
      )}

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
                onClick={() => {
                  setActive(isActive ? null : key);
                  if (isActive) setCompare(null);
                }}
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
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <span className="text-[18px] font-semibold text-white">
                {activeConfig.label} — Curva de Rendimiento
              </span>
              {/* Compare dropdown */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-dim">Comparar con:</span>
                <select
                  value={compare || ""}
                  onChange={(e) => setCompare(e.target.value || null)}
                  className="bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-white outline-none"
                  style={{ minWidth: 160 }}
                >
                  <option value="">Ninguno</option>
                  {sectionKeys
                    .filter((k) => k !== active)
                    .map((k) => (
                      <option key={k} value={k}>
                        {SECTION_CONFIG[k]?.label || k}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartData} margin={{ top: 15, right: 15, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="bondGrad1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={activeConfig.color} stopOpacity={0.15} />
                    <stop offset="95%" stopColor={activeConfig.color} stopOpacity={0} />
                  </linearGradient>
                  {isComparing && compareConfig && (
                    <linearGradient id="bondGrad2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={compareConfig.color} stopOpacity={0.1} />
                      <stop offset="95%" stopColor={compareConfig.color} stopOpacity={0} />
                    </linearGradient>
                  )}
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
                <Tooltip content={isComparing ? <CompareTooltip /> : <SingleTooltip />} cursor={{ stroke: "#94A3B8", strokeOpacity: 0.3 }} />
                {isComparing ? (
                  <>
                    <Area
                      type="monotone"
                      dataKey="tir1"
                      name={activeConfig.label}
                      stroke={activeConfig.color}
                      strokeWidth={2}
                      fill="url(#bondGrad1)"
                      dot={{ r: 3, fill: activeConfig.color, strokeWidth: 0 }}
                      activeDot={{ r: 5, fill: activeConfig.color, stroke: "#fff", strokeWidth: 2 }}
                      connectNulls
                    />
                    <Area
                      type="monotone"
                      dataKey="tir2"
                      name={compareConfig.label}
                      stroke={compareConfig.color}
                      strokeWidth={2}
                      fill="url(#bondGrad2)"
                      dot={{ r: 3, fill: compareConfig.color, strokeWidth: 0 }}
                      activeDot={{ r: 5, fill: compareConfig.color, stroke: "#fff", strokeWidth: 2 }}
                      connectNulls
                    />
                    <Legend
                      verticalAlign="top"
                      height={30}
                      formatter={(value) => <span style={{ color: "#CBD5E0", fontSize: 12 }}>{value}</span>}
                    />
                  </>
                ) : (
                  <Area
                    type="monotone"
                    dataKey="tir"
                    name={activeConfig.label}
                    stroke={activeConfig.color}
                    strokeWidth={2}
                    fill="url(#bondGrad1)"
                    dot={{ r: 4, fill: activeConfig.color, strokeWidth: 0 }}
                    activeDot={{ r: 6, fill: activeConfig.color, stroke: "#ffffff", strokeWidth: 2 }}
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Table */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <table className="w-full" style={{ tableLayout: "fixed" }}>
              <thead>
                <tr style={{ backgroundColor: "#0d0d1a" }}>
                  <th className="py-2 px-2 text-left text-xs font-bold text-[#94A3B8] uppercase tracking-wide" style={{ width: "22%" }}>Cupón</th>
                  <th className="py-2 px-2 text-left text-xs font-bold text-[#94A3B8] uppercase tracking-wide" style={{ width: "22%" }}>Vencimiento</th>
                  <th className="py-2 px-2 text-right text-xs font-bold text-[#94A3B8] uppercase tracking-wide" style={{ width: "18%" }}>Precio</th>
                  <th className="py-2 px-2 text-right text-xs font-bold text-[#94A3B8] uppercase tracking-wide" style={{ width: "14%" }}>TIR</th>
                  <th className="py-2 px-2 text-center text-xs font-bold text-[#94A3B8] uppercase tracking-wide" style={{ width: "24%" }}></th>
                </tr>
              </thead>
              <tbody>
                {activeData.map((b, i) => (
                  <tr key={i} className={`border-b border-border ${i % 2 === 0 ? "" : "bg-white/[0.01]"}`}>
                    <td className="px-2 py-1.5 text-sm text-white font-mono">{b.cupon !== null ? b.cupon.toFixed(3) + "%" : "\u2014"}</td>
                    <td className="px-2 py-1.5 text-sm text-white">{b.vencimiento}</td>
                    <td className="px-2 py-1.5 text-right text-sm text-white font-mono">{b.precio?.toFixed(2) ?? "\u2014"}</td>
                    <td className="px-2 py-1.5 text-right text-sm font-semibold font-mono" style={{ color: activeConfig.color }}>
                      {b.tir.toFixed(2)}%
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <button
                        onClick={() => setTirBond(b)}
                        className="px-3 py-1 rounded-md text-xs font-semibold bg-white/5 border border-white/10 text-text-sec hover:text-white hover:border-white/20 transition"
                      >
                        Calc TIR
                      </button>
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
