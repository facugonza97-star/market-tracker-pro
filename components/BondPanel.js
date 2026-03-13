"use client";
import { useState, useRef } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from "recharts";

const SECTION_MAP = {
  "BONOS GLOBALES URUGUAY EN USD": { label: "\u{1F1FA}\u{1F1FE} Uruguay USD", color: "#5B8DEF" },
  "BONOS GLOBALES URUGUAY EN PESOS": { label: "\u{1F1FA}\u{1F1FE} Uruguay Pesos", color: "#5B8DEF" },
  "NOTAS EN UNIDADES INDEXADAS": { label: "\u{1F1FA}\u{1F1FE} Notas UI", color: "#5B8DEF" },
  "NOTAS EN PESOS URUGUAYOS": { label: "\u{1F1FA}\u{1F1FE} Notas Pesos", color: "#5B8DEF" },
  "BONOS SOBERANOS EEUU": { label: "\u{1F1FA}\u{1F1F8} US Treasuries", color: "#34D399" },
  "US TIPS": { label: "\u{1F1FA}\u{1F1F8} US TIPS", color: "#34D399" },
  "LETRAS DEL TESORO EEUU": { label: "\u{1F1FA}\u{1F1F8} T-bills", color: "#34D399" },
  "BONOS CUP\u00D3N CERO EEUU": { label: "\u{1F1FA}\u{1F1F8} Strips", color: "#34D399" },
  "CURVA PEMEX": { label: "\u{1F1F2}\u{1F1FD} PEMEX", color: "#F59E0B" },
  "CURVA PETROBRAS": { label: "\u{1F1E7}\u{1F1F7} Petrobras", color: "#FBBF24" },
  "BONOS SOBERANOS BRASIL": { label: "\u{1F1E7}\u{1F1F7} Brasil", color: "#FBBF24" },
  "CURVA ECOPETROL": { label: "\u{1F1E8}\u{1F1F4} Ecopetrol", color: "#EF4444" },
  "CURVA PANAMA": { label: "\u{1F1F5}\u{1F1E6} Panama", color: "#A78BFA" },
};

function normalizeKey(text) {
  return text.toUpperCase().replace(/[^A-Z\u00C0-\u00FF\s]/g, "").trim();
}

function findSectionKey(text) {
  const norm = normalizeKey(text);
  for (const key of Object.keys(SECTION_MAP)) {
    if (norm.includes(key)) return key;
  }
  return null;
}

function parseEuropeanNum(str) {
  if (!str) return null;
  const clean = str.replace(/"/g, "").trim().replace(",", ".");
  const n = parseFloat(clean);
  return isNaN(n) ? null : n;
}

function parseDate(str) {
  if (!str) return null;
  const clean = str.replace(/"/g, "").trim();
  // Try DD/MM/YYYY
  const parts = clean.split("/");
  if (parts.length === 3) {
    const [d, m, y] = parts.map(Number);
    if (y > 2000) return new Date(y, m - 1, d);
  }
  // Fallback
  const d = new Date(clean);
  return isNaN(d.getTime()) ? null : d;
}

function extractYear(str) {
  const d = parseDate(str);
  if (d) return d.getFullYear();
  // Try to find a 4-digit year
  const match = str.match(/\b(20\d{2})\b/);
  return match ? parseInt(match[1]) : null;
}

async function parsePDF(file) {
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjsLib.GlobalWorkerOptions.workerSrc = "";

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  let allLines = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();

    // Group items by Y position into lines
    const lineMap = {};
    for (const item of content.items) {
      const y = Math.round(item.transform[5]);
      if (!lineMap[y]) lineMap[y] = [];
      lineMap[y].push({ x: item.transform[4], text: item.str });
    }

    // Sort lines by Y (top to bottom = descending Y)
    const sortedYs = Object.keys(lineMap).map(Number).sort((a, b) => b - a);
    for (const y of sortedYs) {
      const items = lineMap[y].sort((a, b) => a.x - b.x);
      const lineText = items.map((it) => it.text).join(" ").trim();
      if (lineText) allLines.push({ text: lineText, items });
    }
  }

  // DEBUG: log raw extracted text
  console.log("=== PDF RAW TEXT START ===");
  allLines.forEach((line, idx) => {
    console.log(`LINE ${idx}: [${line.items.length} items] ${line.text}`);
  });
  console.log("=== PDF RAW TEXT END ===");
  console.log("Total lines extracted:", allLines.length);

  // Parse sections
  const sections = {};
  let currentSection = null;

  for (const line of allLines) {
    const sectionKey = findSectionKey(line.text);
    if (sectionKey) {
      currentSection = sectionKey;
      if (!sections[currentSection]) sections[currentSection] = [];
      continue;
    }

    if (!currentSection) continue;

    // Try to parse bond data from this line
    // Look for patterns: cupon number, date, price number, TIR number
    const tokens = line.items.map((it) => it.text.trim()).filter(Boolean);
    if (tokens.length < 3) continue;

    // Find numeric tokens and date tokens
    const numericTokens = [];
    let dateToken = null;

    for (const t of tokens) {
      // Check if date
      if (/\d{1,2}\/\d{1,2}\/\d{4}/.test(t) || /\d{4}-\d{2}-\d{2}/.test(t)) {
        dateToken = t;
      } else {
        const n = parseEuropeanNum(t);
        if (n !== null) numericTokens.push({ text: t, val: n });
      }
    }

    // We need at least a date and some numbers to form a bond row
    if (!dateToken || numericTokens.length < 2) continue;

    // Skip header-like rows
    if (line.text.toUpperCase().includes("CUPON") || line.text.toUpperCase().includes("VENCIMIENTO")) continue;
    // Skip rows that look like section headers
    if (findSectionKey(line.text)) continue;

    // Heuristic: cupon is usually first number, precio and TIR are last two
    const cupon = numericTokens.length >= 3 ? numericTokens[0].val : null;
    const precio = numericTokens.length >= 3 ? numericTokens[numericTokens.length - 2].val : numericTokens[0].val;
    const tir = numericTokens[numericTokens.length - 1].val;

    const year = extractYear(dateToken);
    if (!year || !tir) continue;

    sections[currentSection].push({
      cupon,
      vencimiento: dateToken,
      year,
      precio,
      tir,
    });
  }

  // Sort each section by year
  for (const key of Object.keys(sections)) {
    sections[key].sort((a, b) => a.year - b.year);
  }

  return sections;
}

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
      <div style={{ color: "#CBD5E0", fontSize: 12 }}>Precio: {d.precio?.toFixed(2) ?? "—"}</div>
      <div style={{ color: "#ffffff", fontSize: 14, fontWeight: 600, fontFamily: "monospace" }}>
        TIR: {d.tir.toFixed(2)}%
      </div>
    </div>
  );
}

export default function BondPanel() {
  const [sections, setSections] = useState(null);
  const [active, setActive] = useState(null);
  const [parsing, setParsing] = useState(false);
  const fileRef = useRef(null);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParsing(true);
    try {
      const result = await parsePDF(file);
      setSections(result);
      setActive(null);
    } catch (err) {
      console.error("PDF parse error:", err);
    }
    setParsing(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const sectionKeys = sections ? Object.keys(sections).filter((k) => sections[k].length > 0) : [];
  const activeData = active && sections?.[active] ? sections[active] : null;
  const activeConfig = active ? SECTION_MAP[active] : null;

  const rates = activeData?.map((d) => d.tir) || [];
  const minRate = rates.length ? Math.floor(Math.min(...rates) * 10) / 10 - 0.3 : 0;
  const maxRate = rates.length ? Math.ceil(Math.max(...rates) * 10) / 10 + 0.5 : 10;

  return (
    <div className="px-6 py-5 space-y-5">
      {/* Header with upload */}
      <div className="flex items-center justify-between">
        <span className="text-[20px] font-semibold text-white">Bonos</span>
        <label className="bg-accent text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-accent/80 transition cursor-pointer">
          📄 Subir PDF de Bonos
          <input
            ref={fileRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={handleFile}
          />
        </label>
      </div>

      {parsing && (
        <div className="text-center text-text-sec text-sm py-10">Procesando PDF...</div>
      )}

      {/* Issuer buttons */}
      {sectionKeys.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {sectionKeys.map((key) => {
            const cfg = SECTION_MAP[key] || { label: key, color: "#5B8DEF" };
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

      {!sections && !parsing && (
        <div className="flex items-center justify-center h-40">
          <div className="text-text-sec text-sm">Subí un PDF de bonos para ver las curvas de rendimiento.</div>
        </div>
      )}

      {sections && sectionKeys.length === 0 && !parsing && (
        <div className="flex items-center justify-center h-40">
          <div className="text-text-sec text-sm">No se encontraron secciones de bonos en el PDF.</div>
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
                    <td className="px-3 py-2 text-sm text-white font-mono">{b.cupon !== null ? b.cupon.toFixed(3) + "%" : "—"}</td>
                    <td className="px-3 py-2 text-sm text-white">{b.vencimiento}</td>
                    <td className="px-3 py-2 text-right text-sm text-white font-mono">{b.precio?.toFixed(2) ?? "—"}</td>
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
