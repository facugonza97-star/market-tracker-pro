"use client";
import React, { useState } from "react";
import { heatColor, fmtPct, fmtPrice } from "@/lib/utils";

const COLS = [
  { key: "d1", label: "1D" },
  { key: "w1", label: "1W" },
  { key: "m1", label: "1M" },
  { key: "ytd", label: "YTD" },
  { key: "y1", label: "1Y" },
  { key: "y3", label: "3Y" },
  { key: "y5", label: "5Y" },
];

function HeatCell({ val }) {
  const h = heatColor(val);
  return (
    <td
      className="px-1.5 py-2 text-center text-[14px] font-medium font-mono"
      style={{ backgroundColor: h.bg, color: h.color }}
    >
      {fmtPct(val)}
    </td>
  );
}

export default function TrackerTable({ quotes }) {
  const [openSections, setOpenSections] = useState(
    quotes?.sections ? Object.keys(quotes.sections) : []
  );
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState("desc");

  if (!quotes?.sections) return null;

  const toggle = (name) =>
    setOpenSections((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );

  const handleSort = (key) => {
    if (sortCol === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortCol(key); setSortDir("desc"); }
  };

  const sortItems = (items) => {
    if (!sortCol) return items;
    return [...items].sort((a, b) => {
      const av = parseFloat(a[sortCol]) || 0;
      const bv = parseFloat(b[sortCol]) || 0;
      return sortDir === "desc" ? bv - av : av - bv;
    });
  };

  const totalCols = 5 + COLS.length;

  return (
    <div className="bg-card border border-border rounded-xl overflow-x-auto mt-4" style={{ maxHeight: "80vh", overflowY: "auto" }}>
      <table className="w-full">
        <thead>
          <tr>
            <th className="px-3 py-3 text-left text-[12px] font-bold text-[#94A3B8] uppercase tracking-wider" style={{ position: "sticky", top: 0, zIndex: 10, background: "#0F1520" }}>Name</th>
            <th className="px-2 py-3 text-left text-[12px] font-bold text-[#94A3B8] uppercase tracking-wider" style={{ position: "sticky", top: 0, zIndex: 10, background: "#0F1520" }}>Ticker</th>
            <th className="px-2 py-3 text-center text-[12px] font-bold text-[#94A3B8] uppercase tracking-wider" style={{ position: "sticky", top: 0, zIndex: 10, background: "#0F1520" }}>Price</th>
            <th className="px-2 py-3 text-center text-[12px] font-bold text-[#94A3B8] uppercase tracking-wider" style={{ position: "sticky", top: 0, zIndex: 10, background: "#0F1520" }}>52W Hi</th>
            <th className="px-2 py-3 text-center text-[12px] font-bold text-[#94A3B8] uppercase tracking-wider" style={{ position: "sticky", top: 0, zIndex: 10, background: "#0F1520" }}>% 52WH</th>
            {COLS.map((c) => (
              <th
                key={c.key}
                onClick={() => handleSort(c.key)}
                className="px-1.5 py-3 text-center text-[12px] font-bold text-[#94A3B8] uppercase tracking-wider cursor-pointer hover:text-white select-none"
                style={{ position: "sticky", top: 0, zIndex: 10, background: "#0F1520" }}
              >
                {c.label} {sortCol === c.key && (sortDir === "desc" ? "↓" : "↑")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Object.entries(quotes.sections).map(([sectionName, items]) => (
            <React.Fragment key={sectionName}>
              <tr
                onClick={() => toggle(sectionName)}
                className="cursor-pointer hover:bg-card-hover"
              >
                <td
                  colSpan={totalCols}
                  className="px-3 py-2 bg-card-alt border-b border-border"
                >
                  <span className="text-[10px] font-bold text-accent uppercase tracking-[0.15em]">
                    <span className="text-text-dim text-[8px] mr-1.5">
                      {openSections.includes(sectionName) ? "▼" : "▶"}
                    </span>
                    {sectionName}
                  </span>
                  <span className="text-[10px] text-text-dim ml-2 font-normal">
                    {items.length}
                  </span>
                </td>
              </tr>
              {openSections.includes(sectionName) &&
                sortItems(items).map((item, i) => {
                  // % respecto al máximo de 52 semanas: negativo cuando el precio
                  // está por debajo del máximo, 0 cuando lo iguala.
                  const pct52 = item.yearHigh && item.price
                    ? (((item.price - item.yearHigh) / item.yearHigh) * 100).toFixed(1)
                    : null;
                  return (
                    <tr
                      key={i}
                      className={`border-b border-border hover:bg-card-hover ${
                        i % 2 === 0 ? "" : "bg-white/[0.01]"
                      }`}
                    >
                      <td className="px-3 py-2 text-[14px] font-medium text-white">{item.name}</td>
                      <td className="px-2 py-2 text-[14px] text-accent font-mono font-medium">{item.ticker}</td>
                      <td className="px-2 py-2 text-center text-[14px] text-price font-semibold font-mono">
                        {fmtPrice(item.price)}
                      </td>
                      <td className="px-2 py-2 text-center text-[14px] text-white font-mono">
                        {fmtPrice(item.yearHigh)}
                      </td>
                      <HeatCell val={pct52} />
                      {COLS.map((c) => (
                        <HeatCell key={c.key} val={item[c.key]} />
                      ))}
                    </tr>
                  );
                })}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
