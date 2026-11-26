"use client";
import { useState, useEffect, useMemo } from "react";
import { REGION_CHIPS } from "@/lib/countryEtfs";

const MOV_COLS = [
  { key: "m1", label: "1M" },
  { key: "m3", label: "3M" },
  { key: "m6", label: "6M" },
  { key: "ytd", label: "YTD" },
  { key: "y1", label: "1A" },
  { key: "y3", label: "3A" },
];

function fmt(v) {
  if (v === null || v === undefined) return "-";
  return v.toFixed(1).replace(".", ",");
}
function fmtSigned(v) {
  if (v === null || v === undefined) return "-";
  return (v > 0 ? "+" : "") + v.toFixed(1).replace(".", ",");
}
function toneClass(v) {
  if (v === null || v === undefined) return "text-text-dim";
  return v > 0 ? "text-pos" : v < 0 ? "text-neg" : "text-text-dim";
}
function fmtDate(d) {
  if (!d) return "-";
  return new Date(d + "T00:00:00Z").toLocaleDateString("es-UY", { day: "2-digit", month: "short", year: "numeric" });
}

// value of a return column for a row
function getVal(row, col) {
  if (!row) return null;
  return col.kind === "cal" ? (row.returns.cal?.[col.year] ?? null) : (row.returns[col.key] ?? null);
}

export default function CountryReturns() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const [region, setRegion] = useState("Todos");
  const [sortCol, setSortCol] = useState({ kind: "mov", key: "ytd" });
  const [sortDir, setSortDir] = useState("desc");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/country-returns")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d && Array.isArray(d.rows) && d.rows.length) setData(d);
        else setError(true);
      })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, []);

  const calCols = useMemo(
    () => (data?.calYears || []).map((y) => ({ kind: "cal", year: y, label: String(y) })),
    [data]
  );
  const allReturnCols = useMemo(
    () => [...MOV_COLS.map((c) => ({ kind: "mov", ...c })), ...calCols],
    [calCols]
  );

  const aggregates = useMemo(() => (data?.rows || []).filter((r) => r.aggregate), [data]);
  const spy = useMemo(() => aggregates.find((r) => r.ticker === "SPY"), [aggregates]);

  const countries = useMemo(() => {
    let list = (data?.rows || []).filter((r) => !r.aggregate);
    if (region === "Latam") list = list.filter((r) => r.latam);
    else if (region !== "Todos") list = list.filter((r) => r.region === region);
    const sorted = [...list].sort((a, b) => {
      const av = getVal(a, sortCol), bv = getVal(b, sortCol);
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      return sortDir === "desc" ? bv - av : av - bv;
    });
    return sorted;
  }, [data, region, sortCol, sortDir]);

  const handleSort = (col) => {
    const same = sortCol.kind === col.kind && (col.kind === "cal" ? sortCol.year === col.year : sortCol.key === col.key);
    if (same) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortCol(col); setSortDir("desc"); }
  };
  const isActive = (col) => sortCol.kind === col.kind && (col.kind === "cal" ? sortCol.year === col.year : sortCol.key === col.key);

  // sticky column styles
  const stickyBase = { position: "sticky", zIndex: 2 };
  const colRank = { ...stickyBase, left: 0, width: 34, minWidth: 34 };
  const colName = { ...stickyBase, left: 34, width: 116, minWidth: 116 };
  const colTkr = { ...stickyBase, left: 150, width: 52, minWidth: 52 };

  const headBg = "#0d0d1a";
  const thRet = "px-2.5 py-2 text-right text-[11px] font-bold uppercase tracking-wide cursor-pointer select-none whitespace-nowrap";

  const renderHeadCell = (col, strongLeft) => (
    <th
      key={col.label}
      onClick={() => handleSort(col)}
      className={`${thRet} ${isActive(col) ? "text-price" : "text-[#94A3B8] hover:text-white"} ${strongLeft ? "border-l-2 border-white/20" : "border-l border-white/10"}`}
      style={{ background: headBg }}
    >
      {col.label}{isActive(col) ? (sortDir === "desc" ? " ↓" : " ↑") : ""}
    </th>
  );

  const retTd = (v, strongLeft) => (
    <td className={`px-2.5 py-1.5 text-right text-[12px] font-mono tabular-nums ${toneClass(v)} ${strongLeft ? "border-l-2 border-white/15" : "border-l border-white/5"}`}>
      {fmt(v)}
    </td>
  );

  return (
    <div className="px-6 py-5">
      <div className="flex items-center gap-2.5 mb-4">
        <span className="w-[3px] h-3.5 rounded-full bg-accent" />
        <span className="text-[13px] font-bold text-accent uppercase tracking-[0.15em]">
          Global Equity ETFs — Total Returns (USD)
        </span>
      </div>

      {data === null && !error ? (
        <div className="text-sm text-text-sec h-64 flex items-center justify-center">Cargando retornos...</div>
      ) : error && data === null ? (
        <div className="text-sm text-text-sec h-64 flex items-center justify-center">No se pudieron cargar los retornos.</div>
      ) : (
        <>
          {/* Region filter chips (countries only) */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            {REGION_CHIPS.map((c) => (
              <button
                key={c}
                onClick={() => setRegion(c)}
                className={`px-3 py-1 rounded text-[11px] font-semibold transition border ${
                  region === c ? "bg-white/10 border-white/30 text-white" : "bg-card border-border text-text-sec hover:text-white"
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          <div className="overflow-x-auto rounded-md border border-border">
            <table className="border-collapse" style={{ background: "#000000", minWidth: 900 }}>
              {/* group header row */}
              <thead>
                <tr>
                  <th style={{ ...colRank, background: headBg }} className="z-[3]"></th>
                  <th style={{ ...colName, background: headBg }} className="z-[3] px-2.5 py-1.5 text-left text-[10px] text-text-dim uppercase tracking-wider">&nbsp;</th>
                  <th style={{ ...colTkr, background: headBg }} className="z-[3]"></th>
                  <th colSpan={MOV_COLS.length} className="px-2 py-1.5 text-center text-[10px] text-text-dim uppercase tracking-[0.2em] border-l border-white/10" style={{ background: headBg }}>Períodos</th>
                  <th colSpan={calCols.length} className="px-2 py-1.5 text-center text-[10px] text-text-dim uppercase tracking-[0.2em] border-l-2 border-white/20" style={{ background: headBg }}>Años calendario</th>
                  <th className="px-2 py-1.5 text-center text-[10px] text-text-dim uppercase tracking-wider border-l-2 border-white/20" style={{ background: headBg }}>&nbsp;</th>
                </tr>
                {/* column header row */}
                <tr>
                  <th style={{ ...colRank, background: headBg }} className="z-[3] px-1 py-2 text-right text-[11px] font-bold text-[#94A3B8]">#</th>
                  <th style={{ ...colName, background: headBg }} className="z-[3] px-2.5 py-2 text-left text-[11px] font-bold text-[#94A3B8] uppercase tracking-wide">País</th>
                  <th style={{ ...colTkr, background: headBg }} className="z-[3] px-2 py-2 text-left text-[11px] font-bold text-[#94A3B8] uppercase tracking-wide border-r border-white/10">Ticker</th>
                  {MOV_COLS.map((c, i) => renderHeadCell({ kind: "mov", ...c }, i === 0))}
                  {calCols.map((c, i) => renderHeadCell(c, i === 0))}
                  <th className="px-2.5 py-2 text-right text-[11px] font-bold text-[#94A3B8] uppercase tracking-wide border-l-2 border-white/20 whitespace-nowrap" style={{ background: headBg }}>vs EE.UU.</th>
                </tr>
              </thead>

              <tbody>
                {/* Benchmarks block — always visible, navy, outside sort/filter */}
                <tr>
                  <td colSpan={3 + allReturnCols.length + 1} className="px-3 py-1 text-[10px] font-bold text-accent uppercase tracking-[0.18em]" style={{ background: "#0d0d1a" }}>
                    Benchmarks y regiones
                  </td>
                </tr>
                {aggregates.map((r) => {
                  const isSpy = r.ticker === "SPY";
                  const rowBg = isSpy ? "#6b5a3a" : "#031D38";
                  return (
                    <tr key={r.ticker} style={{ background: rowBg }}>
                      <td style={{ ...colRank, background: rowBg }}></td>
                      <td style={{ ...colName, background: rowBg }} className="px-2.5 py-1.5 text-[12px] text-price whitespace-nowrap overflow-hidden text-ellipsis">{r.name}</td>
                      <td style={{ ...colTkr, background: rowBg }} className="px-2 py-1.5 text-[11px] text-text-sec font-mono border-r border-white/10">{r.ticker}</td>
                      {MOV_COLS.map((c, i) => retTd(getVal(r, { kind: "mov", ...c }), i === 0))}
                      {calCols.map((c, i) => retTd(getVal(r, c), i === 0))}
                      <td className="px-2.5 py-1.5 text-right text-[12px] font-mono text-text-dim border-l-2 border-white/15">—</td>
                    </tr>
                  );
                })}

                {/* Countries block */}
                <tr>
                  <td colSpan={3 + allReturnCols.length + 1} className="px-3 py-1 text-[10px] font-bold text-accent uppercase tracking-[0.18em]" style={{ background: "#0d0d1a" }}>
                    Países
                  </td>
                </tr>
                {countries.map((r, idx) => {
                  const vs = (() => {
                    const rv = getVal(r, sortCol), sv = getVal(spy, sortCol);
                    return rv !== null && sv !== null ? rv - sv : null;
                  })();
                  return (
                    <tr key={r.ticker} className="group border-t border-white/5 hover:bg-[#1a2f52]">
                      <td style={colRank} className="bg-black group-hover:bg-[#1a2f52] px-1 py-1.5 text-right text-[11px] text-text-dim font-mono">{idx + 1}</td>
                      <td style={colName} className="bg-black group-hover:bg-[#1a2f52] px-2.5 py-1.5 text-[12px] text-price whitespace-nowrap overflow-hidden text-ellipsis">{r.name}</td>
                      <td style={colTkr} className="bg-black group-hover:bg-[#1a2f52] px-2 py-1.5 text-[11px] text-text-sec font-mono border-r border-white/10">{r.ticker}</td>
                      {MOV_COLS.map((c, i) => retTd(getVal(r, { kind: "mov", ...c }), i === 0))}
                      {calCols.map((c, i) => retTd(getVal(r, c), i === 0))}
                      <td className={`px-2.5 py-1.5 text-right text-[12px] font-mono tabular-nums font-semibold border-l-2 border-white/15 ${toneClass(vs)}`}>
                        {fmtSigned(vs)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="text-[10px] text-text-dim mt-3 leading-relaxed">
            Retorno total en USD, precio ajustado por dividendos. Datos al {fmtDate(data.lastDataDate)}. ETFs como proxy del mercado de cada país.
          </div>
        </>
      )}
    </div>
  );
}
