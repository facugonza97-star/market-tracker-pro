"use client";
import { useState, useEffect, useRef } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

const SECTION_CONFIG = {
  "Uruguay USD": { label: "🇺🇾 Uruguay USD", color: "#5B8DEF" },
  "Uruguay Pesos": { label: "🇺🇾 Uruguay Pesos", color: "#38BDF8" },
  "Notas UI": { label: "🇺🇾 Notas UI", color: "#A78BFA" },
  "Notas Pesos": { label: "🇺🇾 Notas Pesos", color: "#F472B6" },
  "US Treasuries": { label: "🇺🇸 US Treasuries", color: "#48BB78" },
  "US TIPS": { label: "🇺🇸 US TIPS", color: "#86EFAC" },
  "T-bills": { label: "🇺🇸 T-bills", color: "#34D399" },
  "Strips": { label: "🇺🇸 Strips", color: "#2DD4BF" },
  "PEMEX": { label: "🇲🇽 PEMEX", color: "#FB923C" },
  "Petrobras": { label: "🇧🇷 Petrobras", color: "#FBBF24" },
  "Brasil": { label: "🇧🇷 Brasil", color: "#F59E0B" },
  "Ecopetrol": { label: "🇨🇴 Ecopetrol", color: "#F87171" },
  "Panama": { label: "🇵🇦 Panama", color: "#C084FC" },
};

function parseFecha(vencimientoStr) {
  if (!vencimientoStr) return null;
  const str = vencimientoStr.toString().trim();
  const partes = str.split("/");
  if (partes.length === 3) {
    const dd = parseInt(partes[0]);
    const mm = parseInt(partes[1]) - 1;
    const yyyy = parseInt(partes[2]);
    if (!isNaN(dd) && !isNaN(mm) && !isNaN(yyyy)) return new Date(yyyy, mm, dd);
  }
  const d = new Date(str);
  return isNaN(d) ? null : d;
}

function getCouponDates(maturityDate) {
  const dates = [];
  const d = new Date(maturityDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  while (d > today) { dates.unshift(new Date(d)); d.setMonth(d.getMonth() - 6); }
  dates.unshift(new Date(d));
  return dates;
}

function calcularTIR(precioLimpio, cuponAnual, vencimientoStr) {
  const precio = parseFloat(precioLimpio);
  const cupon = parseFloat(cuponAnual);
  if (isNaN(precio) || isNaN(cupon) || precio <= 0 || cupon < 0) return null;
  const maturity = parseFecha(vencimientoStr);
  if (!maturity || isNaN(maturity)) return null;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  if (maturity <= hoy) return null;
  const couponSemestral = (cupon / 100 / 2) * 100;
  const allDates = getCouponDates(maturity);
  if (allDates.length < 2) return null;
  const prevCoupon = allDates[0];
  const nextCoupon = allDates[1];
  const futureDates = allDates.slice(1);
  const T = (nextCoupon - prevCoupon) / 86400000;
  const t = (hoy - prevCoupon) / 86400000;
  const cuponCorrido = couponSemestral * (t / T);
  const precioSucio = precio + cuponCorrido;
  const N = futureDates.length;
  const flujos = futureDates.map((_, i) => i === N - 1 ? couponSemestral + 100 : couponSemestral);
  const exponentes = futureDates.map((_, k) => (T - t) / T + k);
  function precioDado(r) { return flujos.reduce((s, f, i) => s + f / Math.pow(1 + r, exponentes[i]), 0); }
  let lo = 0.00001, hi = 0.5;
  if (precioDado(hi) > precioSucio) hi = 2.0;
  if (precioDado(lo) < precioSucio) return null;
  for (let i = 0; i < 200; i++) { const mid = (lo + hi) / 2; precioDado(mid) > precioSucio ? (lo = mid) : (hi = mid); }
  const rSemestral = (lo + hi) / 2;
  const tirAnual = (Math.pow(1 + rSemestral, 2) - 1) * 100;
  return { tir: tirAnual.toFixed(2), cuponCorrido: cuponCorrido.toFixed(4), precioSucio: precioSucio.toFixed(4) };
}

function stripEmoji(str) {
  return str.replace(/[\u{1F300}-\u{1FFFF}]/gu, "").trim();
}

function buildCurveSVG(data1, color1, label1, data2, color2, label2, comparing) {
  const allData = [...data1, ...(comparing && data2 ? data2 : [])];
  const tirs = allData.map(d => d.tir).filter(v => v != null);
  const years = allData.map(d => d.year).filter(v => v != null);
  if (!tirs.length || !years.length) return "";
  const minY = Math.min(...tirs), maxY = Math.max(...tirs);
  const minX = Math.min(...years), maxX = Math.max(...years);
  const yDecimals = (maxY - minY) < 0.5 ? 3 : 2;
  const px = y => maxX === minX ? 350 : 55 + ((y - minX) / (maxX - minX)) * 615;
  const py = t => maxY === minY ? 80 : 130 - ((t - minY) / (maxY - minY)) * 100;
  let svg = `<line x1="50" y1="15" x2="50" y2="140" stroke="#ccc" stroke-width="0.5"/>`;
  svg += `<line x1="50" y1="140" x2="680" y2="140" stroke="#ccc" stroke-width="0.5"/>`;
  const ySteps = 5;
  for (let i = 0; i <= ySteps; i++) {
    const val = minY + (maxY - minY) * (i / ySteps);
    const yPos = 140 - ((val - minY) / (maxY - minY)) * 125;
    svg += `<text x="48" y="${yPos.toFixed(1)}" text-anchor="end" font-size="8" fill="#999" font-family="Arial">${val.toFixed(yDecimals)}%</text>`;
    svg += `<line x1="52" y1="${yPos.toFixed(1)}" x2="670" y2="${yPos.toFixed(1)}" stroke="#eee" stroke-width="0.5"/>`;
  }
  const pts1 = data1.filter(d => d.tir != null).map(d => `${px(d.year).toFixed(1)},${py(d.tir).toFixed(1)}`).join(" ");
  svg += `<polyline points="${pts1}" fill="none" stroke="${color1}" stroke-width="2.5"/>`;
  data1.filter(d => d.tir != null).forEach(d => { svg += `<circle cx="${px(d.year).toFixed(1)}" cy="${py(d.tir).toFixed(1)}" r="3" fill="${color1}"/>`; });
  if (comparing && data2) {
    const pts2 = data2.filter(d => d.tir != null).map(d => `${px(d.year).toFixed(1)},${py(d.tir).toFixed(1)}`).join(" ");
    svg += `<polyline points="${pts2}" fill="none" stroke="${color2}" stroke-width="2.5" stroke-dasharray="6,3"/>`;
    data2.filter(d => d.tir != null).forEach(d => { svg += `<circle cx="${px(d.year).toFixed(1)}" cy="${py(d.tir).toFixed(1)}" r="3" fill="${color2}"/>`; });
    svg += `<rect x="10" y="8" width="16" height="3" fill="${color1}"/><text x="30" y="13" font-size="10" fill="#444" font-family="Arial">${label1}</text>`;
    svg += `<rect x="10" y="20" width="16" height="3" fill="${color2}"/><text x="30" y="25" font-size="10" fill="#444" font-family="Arial">${label2}</text>`;
  }
  const uniqYears = [...new Set(data1.map(d => d.year))];
  const step = Math.ceil(uniqYears.length / 6);
  uniqYears.filter((_, i) => i % step === 0 || i === uniqYears.length - 1).forEach(y => { svg += `<text x="${px(y).toFixed(1)}" y="150" text-anchor="middle" font-size="9" fill="#999" font-family="Arial">${y}</text>`; });
  return svg;
}

const SECTION_PRINT_NAMES = {
  "Uruguay USD":   { title: "Uruguay USD",   country: "Uruguay" },
  "Uruguay Pesos": { title: "Uruguay Pesos", country: "Uruguay" },
  "Notas UI":      { title: "Notas UI",      country: "Uruguay" },
  "Notas Pesos":   { title: "Notas Pesos",   country: "Uruguay" },
  "US Treasuries": { title: "US Treasuries", country: "Estados Unidos" },
  "US TIPS":       { title: "US TIPS",       country: "Estados Unidos" },
  "T-bills":       { title: "T-bills",       country: "Estados Unidos" },
  "Strips":        { title: "Strips",        country: "Estados Unidos" },
  "PEMEX":         { title: "PEMEX",         country: "México" },
  "Petrobras":     { title: "Petrobras",     country: "Brasil" },
  "Brasil":        { title: "Brasil",        country: "Brasil" },
  "Ecopetrol":     { title: "Ecopetrol",     country: "Colombia" },
  "Panama":        { title: "Panamá",        country: "Panamá" },
};

const SHARED_CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 10px; color: #1a1a2e; padding: 14px 22px; }
  .doc-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; padding-bottom: 9px; border-bottom: 2px solid #1a1a2e; }
  .doc-header h1 { font-size: 17px; font-weight: 700; color: #1a1a2e; margin-bottom: 2px; }
  .doc-header .meta { font-size: 8px; color: #777; }
  .logo-block { text-align: right; }
  .logo-block .logo-name { font-size: 12px; font-weight: 700; color: #1a1a2e; }
  .logo-block .logo-sub { font-size: 8px; color: #999; letter-spacing: .4px; display: block; margin-top: 1px; }
  .section-wrap { margin-bottom: 14px; }
  .section-title-inner { padding: 4px 8px; background: #f0f2f6; border-bottom: 1px solid #d8dce6; }
  .section-title-inner .s-title { font-size: 12px; font-weight: 700; color: #1a1a2e; }
  .section-title-inner .s-sub { font-size: 7.5px; color: #888; margin-top: 1px; }
  .chart-box { background: #f8f9fb; border: .5px solid #d8dce6; border-top: none; height: 112px; }
  table { width: 100%; border-collapse: collapse; font-size: 8.5px; }
  thead tr { background: #eaecf2; }
  thead th { padding: 3px 6px; text-align: left; font-size: 8.5px; font-weight: 700; color: #555; text-transform: uppercase; letter-spacing: .3px; border-bottom: 1px solid #c8ccd8; }
  thead th.r { text-align: right; }
  tbody tr { border-bottom: .5px solid #e8e8e8; }
  tbody tr.alt { background: #f4f6fa; }
  tbody td { padding: 3.5px 6px; color: #1a1a2e; }
  tbody td.r { text-align: right; }
  tbody td.mono { font-family: monospace; }
  tbody td.bid { color: #888; font-family: monospace; }
  tbody td.tir { font-weight: 700; font-family: monospace; }
  .doc-footer { margin-top: 10px; padding-top: 6px; border-top: .5px solid #ccc; display: flex; justify-content: space-between; }
  .doc-footer p { font-size: 7px; color: #aaa; }
  @media print { body { padding: 8px 14px; } @page { margin: .5cm; size: A4; } }
`;

function makeSectionHTML({ key, cfg, data, showChart }) {
  const names = SECTION_PRINT_NAMES[key] || { title: key, country: "" };
  const color = cfg.color;
  const hasCurve = showChart && data.length > 1;
  const rows = data.map((b, i) => {
    const alt = i % 2 === 1 ? ' class="alt"' : '';
    return `<tr${alt}>
      <td>${b.emisor ?? "—"}</td>
      <td class="mono">${b.cupon !== null ? b.cupon.toFixed(3) + "%" : "—"}</td>
      <td>${b.vencimiento}</td>
      <td class="r bid">${b.bid?.toFixed(2) ?? "—"}</td>
      <td class="r mono">${b.ask?.toFixed(2) ?? "—"}</td>
      <td class="r tir" style="color:#1a1a2e">${b.tir != null ? b.tir.toFixed(2) + "%" : "—"}</td>
    </tr>`;
  }).join("");
  const thead = `<thead><tr>
    <th>Emisor</th><th>Cupón</th><th>Vencimiento</th>
    <th class="r">Precio Compra</th><th class="r">Precio Venta</th><th class="r">TIR</th>
  </tr></thead>`;
  const chartHTML = hasCurve
    ? `<div class="chart-box"><svg viewBox="0 0 700 160" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">${buildCurveSVG(data, color, names.title, null, null, "", false)}</svg></div>`
    : "";
  return `<div class="section-wrap">
    <div style="background:#1a1a2e;color:white;padding:5px 10px;font-size:10px;font-weight:700;">
      Curva de Rendimiento — ${names.title}
    </div>
    ${chartHTML}
    <table>${thead}<tbody>${rows}</tbody></table>
  </div>`;
}

function handlePrint({ activeData, activeConfig, compareData, compareConfig, isComparing, lastUpdate }) {
  const today = new Date();
  const fecha = `${String(today.getDate()).padStart(2,"0")}/${String(today.getMonth()+1).padStart(2,"0")}/${today.getFullYear()}`;
  const key = Object.keys(SECTION_CONFIG).find(k => SECTION_CONFIG[k] === activeConfig) || "";
  const names = SECTION_PRINT_NAMES[key] || { title: stripEmoji(activeConfig.label), country: "" };
  const compareKey = isComparing ? Object.keys(SECTION_CONFIG).find(k => SECTION_CONFIG[k] === compareConfig) || "" : "";
  const compareNames = compareKey ? (SECTION_PRINT_NAMES[compareKey] || { title: stripEmoji(compareConfig.label), country: "" }) : null;
  const mainTitle = isComparing ? `${names.title} — comparado con ${compareNames.title}` : names.title;

  let bodySections = makeSectionHTML({ key, cfg: activeConfig, data: activeData, showChart: true });
  if (isComparing && compareData && compareKey) {
    bodySections += makeSectionHTML({ key: compareKey, cfg: compareConfig, data: compareData, showChart: false });
    const combinedSVG = buildCurveSVG(activeData, activeConfig.color, names.title, compareData, compareConfig.color, compareNames.title, true);
    bodySections = bodySections.replace(
      /<svg[^>]*>[\s\S]*?<\/svg>/,
      `<svg viewBox="0 0 700 160" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">${combinedSVG}</svg>`
    );
  }

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
    <title>${names.title} — Curva de Rendimiento</title>
    <style>${SHARED_CSS}</style>
  </head><body>
    <div class="doc-header">
      <div><h1>${mainTitle}</h1>
        <div class="meta">Curva de Rendimiento · Fecha: ${fecha}${lastUpdate ? " · Actualización: " + lastUpdate : ""} · Precios indicativos</div>
      </div>
      <div class="logo-block">
        <div class="logo-name">Gastón Bengochea</div>
        <span class="logo-sub">Corredor de Bolsa</span>
      </div>
    </div>
    ${bodySections}
    <div class="doc-footer">
      <p>Gastón Bengochea Corredor de Bolsa · Precios indicativos, no constituyen oferta de compraventa</p>
      <p>${fecha}</p>
    </div>
    <script>window.onload = () => window.print();<\/script>
  </body></html>`;

  const win = window.open("", "_blank");
  if (win) { win.document.write(html); win.document.close(); }
}

function handlePrintAll({ sections, lastUpdate }) {
  const today = new Date();
  const fecha = `${String(today.getDate()).padStart(2,"0")}/${String(today.getMonth()+1).padStart(2,"0")}/${today.getFullYear()}`;
  const sectionKeys = Object.keys(sections).filter(k => sections[k].length > 0);

  const body = sectionKeys.map(key => {
    const cfg = SECTION_CONFIG[key] || { label: key, color: "#5B8DEF" };
    return makeSectionHTML({ key, cfg, data: sections[key], showChart: key !== "T-bills" });
  }).join("");

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
    <title>Reporte Completo de Bonos</title>
    <style>${SHARED_CSS}</style>
  </head><body>
    <div class="doc-header">
      <div><h1>Reporte Completo de Bonos</h1>
        <div class="meta">Gastón Bengochea Corredor de Bolsa · Fecha: ${fecha}${lastUpdate ? " · Actualización: " + lastUpdate : ""} · Precios indicativos</div>
      </div>
      <div class="logo-block">
        <div class="logo-name">Gastón Bengochea</div>
        <span class="logo-sub">Corredor de Bolsa</span>
      </div>
    </div>
    ${body}
    <div class="doc-footer">
      <p>Gastón Bengochea Corredor de Bolsa · Precios indicativos, no constituyen oferta de compraventa</p>
      <p>${fecha}</p>
    </div>
    <script>window.onload = () => window.print();<\/script>
  </body></html>`;

  const win = window.open("", "_blank");
  if (win) { win.document.write(html); win.document.close(); }
}

function CompareTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  return (<div style={{ background: "#0F1520", border: "1px solid #2A3A50", borderRadius: 8, padding: "8px 12px" }}>{payload.map((p, i) => (<div key={i} style={{ marginBottom: i < payload.length - 1 ? 6 : 0 }}><div style={{ color: p.color, fontSize: 12, fontWeight: 600 }}>{p.name}</div><div style={{ color: "#fff", fontSize: 14, fontWeight: 600, fontFamily: "monospace" }}>{p.value != null ? p.value.toFixed(2) + "%" : "—"}</div></div>))}{payload[0]?.payload?.year && <div style={{ color: "#94A3B8", fontSize: 11, marginTop: 4 }}>{payload[0].payload.year}</div>}</div>);
}

function SingleTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (<div style={{ background: "#0F1520", border: "1px solid #2A3A50", borderRadius: 8, padding: "8px 12px" }}><div style={{ color: "#94A3B8", fontSize: 11, marginBottom: 4 }}>Vencimiento: {d.vencimiento}</div>{d.cupon !== null && <div style={{ color: "#CBD5E0", fontSize: 12 }}>Cupon: {d.cupon.toFixed(3)}%</div>}<div style={{ color: "#CBD5E0", fontSize: 12 }}>Bid: {d.bid?.toFixed(2) ?? "—"} · Ask: {d.ask?.toFixed(2) ?? "—"}</div><div style={{ color: "#fff", fontSize: 14, fontWeight: 600, fontFamily: "monospace" }}>TIR: {d.tir?.toFixed(2)}%</div></div>);
}

function TIRModal({ bond, activeConfig, onClose }) {
  const [precioInput, setPrecioInput] = useState(bond.ask?.toFixed(2) ?? "");
  const resultado = precioInput !== "" ? calcularTIR(precioInput, bond.cupon, bond.vencimiento) : null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.65)" }} onClick={onClose}>
      <div className="rounded-xl p-6 w-96 text-white" style={{ backgroundColor: "#0F1520", border: "1px solid #2A3A50" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-5">
          <div><div className="text-base font-semibold">Calculadora TIR</div><div className="text-xs text-[#94A3B8] mt-0.5">Vto. {bond.vencimiento}</div></div>
          <button onClick={onClose} className="text-[#94A3B8] hover:text-white text-xl leading-none">✕</button>
        </div>
        <div className="flex gap-4 mb-5 text-sm">
          {[["Cupón anual", bond.cupon?.toFixed(3)+"%"], ["Vencimiento", bond.vencimiento], ["Ask", bond.ask?.toFixed(2) ?? "—"]].map(([lbl, val]) => (
            <div key={lbl} className="flex-1 rounded-lg px-3 py-2" style={{ backgroundColor: "#1A2535" }}>
              <div className="text-[#94A3B8] text-xs mb-1">{lbl}</div>
              <div className="font-mono font-semibold">{val}</div>
            </div>
          ))}
        </div>
        <div className="mb-5">
          <label className="block text-xs text-[#94A3B8] mb-1.5">Precio limpio</label>
          <input type="number" value={precioInput} onChange={(e) => setPrecioInput(e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-white font-mono text-sm focus:outline-none" style={{ backgroundColor: "#1A2535", border: "1px solid #2A3A50" }} step="0.01" placeholder="Ej: 102.50" />
        </div>
        {resultado ? (
          <div className="space-y-2">
            {[["Cupón corrido", resultado.cuponCorrido], ["Precio sucio", resultado.precioSucio]].map(([lbl, val]) => (
              <div key={lbl} className="flex justify-between text-sm py-2 border-b" style={{ borderColor: "#1E2D40" }}>
                <span className="text-[#94A3B8]">{lbl}</span><span className="font-mono">{val}</span>
              </div>
            ))}
            <div className="flex justify-between items-center pt-2">
              <span className="text-sm text-[#94A3B8]">TIR anual efectiva</span>
              <span className="text-2xl font-bold font-mono" style={{ color: activeConfig?.color ?? "#5B8DEF" }}>{resultado.tir}%</span>
            </div>
          </div>
        ) : precioInput !== "" ? (
          <div className="text-center text-[#94A3B8] text-sm py-4">No se puede calcular con ese precio</div>
        ) : (
          <div className="text-center text-[#94A3B8] text-sm py-4">Ingresá un precio para calcular la TIR</div>
        )}
      </div>
    </div>
  );
}

export default function BondPanel() {
  const [sections, setSections] = useState(null);
  const [active, setActive] = useState(null);
  const [compare, setCompare] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [tirModal, setTirModal] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    fetch("/api/bonos-timestamp").then(r => r.json()).then(d => { if (d.lastUpdate) setLastUpdate(d.lastUpdate); }).catch(() => {});
    fetch("/api/bonos").then(r => r.json()).then(data => { setSections(data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/parse-bonds", { method: "POST", body: formData });
      if (!res.ok) throw new Error((await res.text()) || `Server error ${res.status}`);
      const result = await res.json();
      setSections(result); setActive(null); setCompare(null);
      fetch("/api/bonos-timestamp").then(r => r.json()).then(d => { if (d.lastUpdate) setLastUpdate(d.lastUpdate); }).catch(() => {});
    } catch (err) { setError(err.message || "Error al procesar el Excel"); }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const sectionKeys = sections ? Object.keys(sections).filter(k => sections[k].length > 0) : [];
  const activeData = active && sections?.[active] ? sections[active] : null;
  const activeConfig = active ? SECTION_CONFIG[active] : null;
  const compareData = compare && sections?.[compare] ? sections[compare] : null;
  const compareConfig = compare ? SECTION_CONFIG[compare] : null;
  const isComparing = !!(activeData && compareData && compare !== active);

  let chartData, allRates;
  if (isComparing) {
    const yearMap = {};
    for (const b of activeData) { if (!yearMap[b.year]) yearMap[b.year] = { year: b.year }; yearMap[b.year].tir1 = b.tir; }
    for (const b of compareData) { if (!yearMap[b.year]) yearMap[b.year] = { year: b.year }; yearMap[b.year].tir2 = b.tir; }
    chartData = Object.values(yearMap).sort((a, b) => a.year - b.year);
    allRates = chartData.flatMap(d => [d.tir1, d.tir2]).filter(v => v != null);
  } else if (activeData) {
    chartData = activeData; allRates = activeData.map(d => d.tir).filter(v => v != null);
  } else { chartData = []; allRates = []; }

  const minRate = allRates.length ? Math.floor(Math.min(...allRates) * 10) / 10 - 0.3 : 0;
  const maxRate = allRates.length ? Math.ceil(Math.max(...allRates) * 10) / 10 + 0.5 : 10;

  return (
    <div className="px-6 py-5 space-y-5">
      {tirModal && <TIRModal bond={tirModal} activeConfig={activeConfig} onClose={() => setTirModal(null)} />}
      <div className="flex items-center justify-between">
        <span className="text-[20px] font-semibold text-white">Bonos</span>
        <div className="flex items-center gap-2">
          {sectionKeys.length > 0 && (
            <button
              onClick={() => handlePrintAll({ sections, lastUpdate })}
              className="border border-white/20 text-text-sec px-4 py-2 rounded-lg text-sm font-semibold hover:text-white hover:border-white/40 transition"
            >
              📄 Imprimir Todo
            </button>
          )}
          <label className={`bg-accent text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-accent/80 transition cursor-pointer ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
            {uploading ? "Procesando..." : "📊 Subir Excel de Bonos"}
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleUpload} disabled={uploading} />
          </label>
        </div>
      </div>
      {lastUpdate && <div className="text-sm text-white">Última actualización precios bonos: {lastUpdate}</div>}
      {error && <div className="text-center text-neg text-sm py-2">{error}</div>}
      {loading && <div className="text-center text-text-sec text-sm py-10">Cargando datos de bonos...</div>}
      {sectionKeys.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {sectionKeys.map((key) => {
            const cfg = SECTION_CONFIG[key] || { label: key, color: "#5B8DEF" };
            const isActive = active === key;
            return (
              <button key={key} onClick={() => { setActive(isActive ? null : key); if (isActive) setCompare(null); }}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition border ${isActive ? "bg-white/10 border-white/30 text-white" : "bg-card border-border text-text-sec hover:text-white hover:border-white/20"}`}>
                {cfg.label}<span className="ml-1.5 text-xs text-text-dim">({sections[key].length})</span>
              </button>
            );
          })}
        </div>
      )}
      {!loading && sectionKeys.length === 0 && (
        <div className="flex items-center justify-center h-40"><div className="text-text-sec text-sm">No hay datos de bonos disponibles.</div></div>
      )}
      {activeData && activeConfig && (
        <div className="space-y-5">
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <span className="text-[18px] font-semibold text-white">{activeConfig.label} — Curva de Rendimiento</span>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-text-dim">Comparar con:</span>
                  <select value={compare || ""} onChange={(e) => setCompare(e.target.value || null)}
                    className="bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-white outline-none" style={{ minWidth: 160 }}>
                    <option value="">Ninguno</option>
                    {sectionKeys.filter(k => k !== active).map(k => (
                      <option key={k} value={k}>{SECTION_CONFIG[k]?.label || k}</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={() => handlePrint({ activeData, activeConfig, compareData: isComparing ? compareData : null, compareConfig: isComparing ? compareConfig : null, isComparing, lastUpdate })}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition border border-white/20 text-text-sec hover:text-white hover:border-white/40">
                  🖨️ Imprimir
                </button>
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
                <XAxis dataKey="year" tick={{ fill: "#94A3B8", fontSize: 12 }} tickLine={false} axisLine={{ stroke: "#1E2D40" }} />
                <YAxis domain={[minRate, maxRate]} tick={{ fill: "#94A3B8", fontSize: 12 }} tickLine={false} axisLine={false} tickFormatter={v => v.toFixed(1) + "%"} width={50} />
                <Tooltip content={isComparing ? <CompareTooltip /> : <SingleTooltip />} cursor={{ stroke: "#94A3B8", strokeOpacity: 0.3 }} />
                {isComparing ? (
                  <>
                    <Area type="monotone" dataKey="tir1" name={activeConfig.label} stroke={activeConfig.color} strokeWidth={2} fill="url(#bondGrad1)" dot={{ r: 3, fill: activeConfig.color, strokeWidth: 0 }} activeDot={{ r: 5, fill: activeConfig.color, stroke: "#fff", strokeWidth: 2 }} connectNulls />
                    <Area type="monotone" dataKey="tir2" name={compareConfig.label} stroke={compareConfig.color} strokeWidth={2} fill="url(#bondGrad2)" dot={{ r: 3, fill: compareConfig.color, strokeWidth: 0 }} activeDot={{ r: 5, fill: compareConfig.color, stroke: "#fff", strokeWidth: 2 }} connectNulls />
                    <Legend verticalAlign="top" height={30} formatter={value => <span style={{ color: "#CBD5E0", fontSize: 12 }}>{value}</span>} />
                  </>
                ) : (
                  <Area type="monotone" dataKey="tir" name={activeConfig.label} stroke={activeConfig.color} strokeWidth={2} fill="url(#bondGrad1)" dot={{ r: 4, fill: activeConfig.color, strokeWidth: 0 }} activeDot={{ r: 6, fill: activeConfig.color, stroke: "#fff", strokeWidth: 2 }} />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-card border border-border rounded-xl overflow-x-auto">
            <table style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ backgroundColor: "#0d0d1a" }}>
                  {["Emisor","Cupón","Vencimiento"].map(h => (<th key={h} className="py-2 px-4 text-left text-xs font-bold text-[#94A3B8] uppercase tracking-wide whitespace-nowrap">{h}</th>))}
                  {["Precio de Compra","Precio de Venta","TIR"].map(h => (<th key={h} className="py-2 px-4 text-right text-xs font-bold text-[#94A3B8] uppercase tracking-wide whitespace-nowrap">{h}</th>))}
                  <th className="py-2 px-4"></th>
                </tr>
              </thead>
              <tbody>
                {activeData.map((b, i) => (
                  <tr key={i} className={`border-b border-border ${i % 2 === 0 ? "" : "bg-white/[0.01]"}`}>
                    <td className="px-4 py-2 text-sm text-white whitespace-nowrap">{b.emisor ?? "—"}</td>
                    <td className="px-4 py-2 text-sm text-white font-mono whitespace-nowrap">{b.cupon !== null ? b.cupon.toFixed(3)+"%" : "—"}</td>
                    <td className="px-4 py-2 text-sm text-white whitespace-nowrap">{b.vencimiento}</td>
                    <td className="px-4 py-2 text-right text-sm text-[#94A3B8] font-mono whitespace-nowrap">{b.bid?.toFixed(2) ?? "—"}</td>
                    <td className="px-4 py-2 text-right text-sm text-white font-mono whitespace-nowrap">{b.ask?.toFixed(2) ?? "—"}</td>
                    <td className="px-4 py-2 text-right text-sm font-semibold font-mono whitespace-nowrap" style={{ color: activeConfig.color }}>{b.tir != null ? b.tir.toFixed(2)+"%" : "—"}</td>
                    <td className="px-4 py-2 text-center whitespace-nowrap">
                      <button onClick={() => setTirModal(b)} className="text-xs px-3 py-1 rounded-md font-semibold transition hover:opacity-80" style={{ backgroundColor: activeConfig.color+"22", color: activeConfig.color, border: `1px solid ${activeConfig.color}44` }}>Calc TIR</button>
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
