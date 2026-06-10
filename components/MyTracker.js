"use client";
import React, { useMemo, useState } from "react";
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

export default function MyTracker({ quotes, myTickers, setMyTickers }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState([]);
  const [saving, setSaving] = useState(false);

  // Flatten all available items from every section, keyed by ticker
  const { allItems, byTicker } = useMemo(() => {
    const items = [];
    const map = {};
    if (quotes?.sections) {
      for (const [cat, list] of Object.entries(quotes.sections)) {
        for (const it of list) {
          if (!map[it.ticker]) {
            const withCat = { ...it, cat };
            map[it.ticker] = withCat;
            items.push(withCat);
          }
        }
      }
    }
    return { allItems: items, byTicker: map };
  }, [quotes]);

  const selected = (myTickers || []).map((t) => byTicker[t]).filter(Boolean);

  const openEditor = () => {
    setDraft(myTickers || []);
    setEditing(true);
  };

  const toggleDraft = (ticker) =>
    setDraft((prev) =>
      prev.includes(ticker) ? prev.filter((t) => t !== ticker) : [...prev, ticker]
    );

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/user-tracker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tickers: draft }),
      });
      if (!res.ok) throw new Error("save failed");
      setMyTickers(draft);
      setEditing(false);
    } catch (e) {
      console.error("Error guardando tracker:", e);
      alert("No se pudo guardar. Intentá de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  const totalCols = 4 + COLS.length;

  return (
    <div className="px-6 py-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <span className="text-[20px] font-semibold text-white">Mi Tracker</span>
        <button
          onClick={openEditor}
          className="bg-card border border-border rounded-lg px-3 py-1.5 text-sm text-white hover:bg-card-hover transition"
        >
          Editar
        </button>
      </div>

      {selected.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
          <div className="text-text-sec text-sm">No tenés instrumentos en tu tracker todavía.</div>
          <button
            onClick={openEditor}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-white/10 border border-white/30 text-white hover:bg-white/20 transition"
          >
            Agregar instrumentos
          </button>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-x-auto" style={{ maxHeight: "80vh", overflowY: "auto" }}>
          <table className="w-full">
            <thead>
              <tr>
                <th className="px-3 py-3 text-left text-[12px] font-bold text-[#94A3B8] uppercase tracking-wider" style={{ position: "sticky", top: 0, zIndex: 10, background: "#0F1520" }}>Name</th>
                <th className="px-2 py-3 text-left text-[12px] font-bold text-[#94A3B8] uppercase tracking-wider" style={{ position: "sticky", top: 0, zIndex: 10, background: "#0F1520" }}>Ticker</th>
                <th className="px-2 py-3 text-center text-[12px] font-bold text-[#94A3B8] uppercase tracking-wider" style={{ position: "sticky", top: 0, zIndex: 10, background: "#0F1520" }}>Price</th>
                <th className="px-2 py-3 text-center text-[12px] font-bold text-[#94A3B8] uppercase tracking-wider" style={{ position: "sticky", top: 0, zIndex: 10, background: "#0F1520" }}>52W Hi</th>
                {COLS.map((c) => (
                  <th key={c.key} className="px-1.5 py-3 text-center text-[12px] font-bold text-[#94A3B8] uppercase tracking-wider" style={{ position: "sticky", top: 0, zIndex: 10, background: "#0F1520" }}>
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {selected.map((item, i) => (
                <tr key={item.ticker} className={`border-b border-border hover:bg-card-hover ${i % 2 === 0 ? "" : "bg-white/[0.01]"}`}>
                  <td className="px-3 py-2 text-[14px] font-medium text-white">{item.name}</td>
                  <td className="px-2 py-2 text-[14px] text-accent font-mono font-medium">{item.ticker}</td>
                  <td className="px-2 py-2 text-center text-[14px] text-white font-semibold font-mono">{fmtPrice(item.price)}</td>
                  <td className="px-2 py-2 text-center text-[14px] text-white font-mono">{fmtPrice(item.yearHigh)}</td>
                  {COLS.map((c) => (
                    <HeatCell key={c.key} val={item[c.key]} />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
          onClick={() => !saving && setEditing(false)}
        >
          <div
            className="bg-card border border-border rounded-xl w-full max-w-2xl max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <span className="text-[16px] font-semibold text-white">Editar instrumentos</span>
              <span className="text-xs text-text-dim">{draft.length} seleccionados</span>
            </div>

            <div className="overflow-y-auto px-5 py-3 flex-1">
              {quotes?.sections &&
                Object.entries(quotes.sections).map(([cat, list]) => (
                  <div key={cat} className="mb-4">
                    <div className="text-[10px] font-bold text-accent uppercase tracking-[0.15em] mb-2">{cat}</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                      {list.map((it) => (
                        <label
                          key={it.ticker}
                          className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-card-hover cursor-pointer text-sm"
                        >
                          <input
                            type="checkbox"
                            checked={draft.includes(it.ticker)}
                            onChange={() => toggleDraft(it.ticker)}
                            className="accent-accent"
                          />
                          <span className="text-accent font-mono">{it.ticker}</span>
                          <span className="text-text-sec truncate">{it.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border">
              <button
                onClick={() => setEditing(false)}
                disabled={saving}
                className="px-4 py-2 rounded-lg text-sm text-text-sec hover:text-white transition disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-white/10 border border-white/30 text-white hover:bg-white/20 transition disabled:opacity-50"
              >
                {saving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
