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

// ============================================================
// CALCULADORA TIR — ICMA Actual/Actual, cupones semianuales
// ============================================================

function parseFecha(vencimientoStr) {
  // Soporta DD/MM/YYYY (formato que viene del sheet: "05/04/2027")
  if (!vencimientoStr) return null;
  const str = vencimientoStr.toString().trim();
  // DD/MM/YYYY
  const partes = str.split("/");
  if (partes.length === 3) {
    const dd = parseInt(partes[0]);
    const mm = parseInt(partes[1]) - 1; // mes base 0
    const yyyy = parseInt(partes[2]);
    if (!isNaN(dd) && !isNaN(mm) && !isNaN(yyyy)) {
      return new Date(yyyy, mm, dd);
    }
  }
  // Fallback: intentar parseo directo
  const d = new Date(str);
  return isNaN(d) ? null : d;
}

function getCouponDates(maturityDate) {
  // Genera todas las fechas de cupón retrocediendo 6 meses desde el vencimiento
  // Devuelve array ordenado: [prevCoupon, ...futuresCoupons, maturity]
  const dates = [];
  const d = new Date(maturityDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  while (d > today) {
    dates.unshift(new Date(d));
    d.setMonth(d.getMonth() - 6);
  }
  // d es ahora el último cupón ANTES o IGUAL a hoy (prevCoupon)
  dates.unshift(new Date(d));

  return dates; // [prevCoupon, nextCoupon, ..., maturity]
}

function calcularTIR(precioLimpio, cuponAnual, vencimientoStr) {
  const precio = parseFloat(precioLimpio);
  const cupon = parseFloat(cuponAnual);
  if (isNaN(precio) || isNaN(cupon) || precio <= 0 || cupon < 0) return null;

  const maturity = parseFecha(vencimientoStr);
  if (!maturity || isNaN(maturity)) return null;

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  if (maturity <= hoy) return null; // bono ya vencido

  const couponSemestral = (cupon / 100 / 2) * 100; // base 100

  const allDates = getCouponDates(maturity);
  if (allDates.length < 2) return null;

  const prevCoupon = allDates[0];
  const nextCoupon = allDates[1];
  const futureDates = allDates.slice(1); // nextCoupon en adelante hasta maturity

  // Días reales Actual/Actual
  const T = (nextCoupon - prevCoupon) / 86400000; // días del período semestral actual
  const t = (hoy - prevCoupon) / 86400000;        // días transcurridos desde prevCoupon

  // Cupón corrido
  const cuponCorrido = couponSemestral * (t / T);
  // Precio sucio
  const precioSucio = precio + cuponCorrido;

  const N = futureDates.length;

  // Flujos: cupón semestral en cada fecha, + 100 en el último
  const flujos = futureDates.map((_, i) =>
    i === N - 1 ? couponSemestral + 100 : couponSemestral
  );

  // Exponentes ICMA Actual/Actual:
  // El primer cupón está a (T-t)/T períodos semianuales de distancia
  // Cada siguiente cupón es +1 período
  const exponentes = futureDates.map((_, k) => (T - t) / T + k);

  // Función que calcula el precio sucio dado r semestral
  function precioDado(r) {
    return flujos.reduce((sum, flujo, i) =>
      sum + flujo / Math.pow(1 + r, exponentes[i]), 0
    );
  }

  // Bisección para encontrar r semestral
  let lo = 0.00001;
  let hi = 0.5;

  // Si precio muy bajo (bono distressed), ampliar rango
  if (precioDado(hi) > precioSucio) hi = 2.0;
  // Si precio muy alto, reducir rango mínimo
  if (precioDado(lo) < precioSucio) return null;

  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (precioDado(mid) > precioSucio) {
      lo = mid;
    } else {
      hi = mid;
    }
  }

  const rSemestral = (lo + hi) / 2;
  // TIR anual efectiva: (1 + r_sem)^2 - 1
  const tirAnual = (Math.pow(1 + rSemestral, 2) - 1) * 100;

  return {
    tir: tirAnual.toFixed(2),
    cuponCorrido: cuponCorrido.toFixed(4),
    precioSucio: precioSucio.toFixed(4),
  };
}

// ============================================================
// TOOLTIPS
// ============================================================

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

// ============================================================
// MODAL CALCULADORA TIR
// ============================================================

function TIRModal({ bond, activeConfig, onClose }) {
  const [precioInput, setPrecioInput] = useState(bond.precio?.toFixed(2) ?? "");

  const resultado = precioInput !== ""
    ? calcularTIR(precioInput, bond.cupon, bond.vencimiento)
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.65)" }}
      onClick={onClose}
    >
      <div
        className="rounded-xl p-6 w-96 text-white"
        style={{ backgroundColor: "#0F1520", border: "1px solid #2A3A50" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-5">
          <div>
            <div className="text-base font-semibold text-white">Calculadora TIR</div>
            <div className="text-xs text-[#94A3B8] mt-0.5">Vto. {bond.vencimiento}</div>
          </div>
          <button
            onClick={onClose}
            className="text-[#94A3B8] hover:text-white text-xl leading-none"
          >
            ✕
          </button>
        </div>

        {/* Info del bono */}
        <div className="flex gap-4 mb-5 text-sm">
          <div className="flex-1 rounded-lg px-3 py-2" style={{ backgroundColor: "#1A2535" }}>
            <div className="text-[#94A3B8] text-xs mb-1">Cupón anual</div>
            <div className="font-mono font-semibold">{bond.cupon?.toFixed(3)}%</div>
          </div>
          <div className="flex-1 rounded-lg px-3 py-2" style={{ backgroundColor: "#1A2535" }}>
            <div className="text-[#94A3B8] text-xs mb-1">Vencimiento</div>
            <div className="font-mono font-semibold">{bond.vencimiento}</div>
          </div>
          <div className="flex-1 rounded-lg px-3 py-2" style={{ backgroundColor: "#1A2535" }}>
            <div className="text-[#94A3B8] text-xs mb-1">Precio mercado</div>
            <div className="font-mono font-semibold">{bond.precio?.toFixed(2) ?? "\u2014"}</div>
          </div>
        </div>

        {/* Input precio */}
        <div className="mb-5">
          <label className="block text-xs text-[#94A3B8] mb-1.5">Precio limpio</label>
          <input
            type="number"
            value={precioInput}
            onChange={(e) => setPrecioInput(e.target.value)}
            className="w-full rounded-lg px-3 py-2.5 text-white font-mono text-sm focus:outline-none focus:ring-2"
            style={{
              backgroundColor: "#1A2535",
              border: "1px solid #2A3A50",
              focusRingColor: activeConfig?.color,
            }}
            step="0.01"
            placeholder="Ej: 102.50"
          />
        </div>

        {/* Resultados */}
        {resultado ? (
          <div className="space-y-2">
            <div className="flex justify-between text-sm py-2 border-b" style={{ borderColor: "#1E2D40" }}>
              <span className="text-[#94A3B8]">Cupón corrido</span>
              <span className="font-mono">{resultado.cuponCorrido}</span>
            </div>
            <div className="flex justify-between text-sm py-2 border-b" style={{ borderColor: "#1E2D40" }}>
              <span className="text-[#94A3B8]">Precio sucio</span>
              <span className="font-mono">{resultado.precioSucio}</span>
            </div>
            <div className="flex justify-between items-center pt-2">
              <span className="text-sm text-[#94A3B8]">TIR anual efectiva</span>
              <span
                className="text-2xl font-bold font-mono"
                style={{ color: activeConfig?.color ?? "#5B8DEF" }}
              >
                {resultado.tir}%
              </span>
            </div>
          </div>
        ) : precioInput !== "" ? (
          <div className="text-center text-[#94A3B8] text-sm py-4">
            No se puede calcular con ese precio
          </div>
        ) : (
          <div className="text-center text-[#94A3B8] text-sm py-4">
            Ingresá un precio para calcular la TIR
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================

export default function BondPanel() {
  const [sections, setSections] = useState(null);
  const [active, setActive] = useState(null);
  const [compare, setCompare] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [source, setSource] = useState(null);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [tirModal, setTirModal] = useState(null); // bono seleccionado para calcular TIR
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
      {/* Modal TIR */}
      {tirModal && (
        <TIRModal
          bond={tirModal}
          activeConfig={activeConfig}
          onClose={() => setTirModal(null)}
        />
      )}

      {/* Header */}
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

      {/* Botones emisores */}
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

      {/* Gráfico + Tabla */}
      {activeData && activeConfig && (
        <div className="space-y-5">
          {/* Gráfico */}
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <span className="text-[18px] font-semibold text-white">
                {activeConfig.label} — Curva de Rendimiento
              </span>
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
                    <Area type="monotone" dataKey="tir1" name={activeConfig.label} stroke={activeConfig.color} strokeWidth={2} fill="url(#bondGrad1)" dot={{ r: 3, fill: activeConfig.color, strokeWidth: 0 }} activeDot={{ r: 5, fill: activeConfig.color, stroke: "#fff", strokeWidth: 2 }} connectNulls />
                    <Area type="monotone" dataKey="tir2" name={compareConfig.label} stroke={compareConfig.color} strokeWidth={2} fill="url(#bondGrad2)" dot={{ r: 3, fill: compareConfig.color, strokeWidth: 0 }} activeDot={{ r: 5, fill: compareConfig.color, stroke: "#fff", strokeWidth: 2 }} connectNulls />
                    <Legend verticalAlign="top" height={30} formatter={(value) => <span style={{ color: "#CBD5E0", fontSize: 12 }}>{value}</span>} />
                  </>
                ) : (
                  <Area type="monotone" dataKey="tir" name={activeConfig.label} stroke={activeConfig.color} strokeWidth={2} fill="url(#bondGrad1)" dot={{ r: 4, fill: activeConfig.color, strokeWidth: 0 }} activeDot={{ r: 6, fill: activeConfig.color, stroke: "#ffffff", strokeWidth: 2 }} />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Tabla */}
          <div className="bg-card border border-border rounded-xl overflow-x-auto">
            <table style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ backgroundColor: "#0d0d1a" }}>
                  <th className="py-2 px-4 text-left text-xs font-bold text-[#94A3B8] uppercase tracking-wide whitespace-nowrap">Cupón</th>
                  <th className="py-2 px-4 text-left text-xs font-bold text-[#94A3B8] uppercase tracking-wide whitespace-nowrap">Vencimiento</th>
                  <th className="py-2 px-4 text-right text-xs font-bold text-[#94A3B8] uppercase tracking-wide whitespace-nowrap">Precio</th>
                  <th className="py-2 px-4 text-right text-xs font-bold text-[#94A3B8] uppercase tracking-wide whitespace-nowrap">TIR</th>
                  <th className="py-2 px-4 text-center text-xs font-bold text-[#94A3B8] uppercase tracking-wide whitespace-nowrap"></th>
                </tr>
              </thead>
              <tbody>
                {activeData.map((b, i) => (
                  <tr key={i} className={`border-b border-border ${i % 2 === 0 ? "" : "bg-white/[0.01]"}`}>
                    <td className="px-4 py-2 text-sm text-white font-mono whitespace-nowrap">{b.cupon !== null ? b.cupon.toFixed(3) + "%" : "\u2014"}</td>
                    <td className="px-4 py-2 text-sm text-white whitespace-nowrap">{b.vencimiento}</td>
                    <td className="px-4 py-2 text-right text-sm text-white font-mono whitespace-nowrap">{b.precio?.toFixed(2) ?? "\u2014"}</td>
                    <td className="px-4 py-2 text-right text-sm font-semibold font-mono whitespace-nowrap" style={{ color: activeConfig.color }}>
                      {b.tir.toFixed(2)}%
                    </td>
                    <td className="px-4 py-2 text-center whitespace-nowrap">
                      <button
                        onClick={() => setTirModal(b)}
                        className="text-xs px-3 py-1 rounded-md font-semibold transition hover:opacity-80"
                        style={{
                          backgroundColor: activeConfig.color + "22",
                          color: activeConfig.color,
                          border: `1px solid ${activeConfig.color}44`,
                        }}
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
