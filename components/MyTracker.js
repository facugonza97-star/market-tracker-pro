"use client";
import React, { useEffect, useRef, useState } from "react";
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
  const [rows, setRows] = useState([]);
  const [loadingRows, setLoadingRows] = useState(false);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState([]);
  const [saving, setSaving] = useState(false);

  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const latestQuery = useRef("");

  // Traer precios/cambios de los tickers del usuario
  useEffect(() => {
    const list = myTickers || [];
    if (!list.length) {
      setRows([]);
      return;
    }
    let cancelled = false;
    setLoadingRows(true);
    fetch(`/api/ticker-quotes?symbols=${encodeURIComponent(list.join(","))}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setRows(d.rows || []);
      })
      .catch(() => {
        if (!cancelled) setRows([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingRows(false);
      });
    return () => {
      cancelled = true;
    };
  }, [myTickers]);

  // Búsqueda en tiempo real (debounce 300ms)
  useEffect(() => {
    const q = query.trim();
    latestQuery.current = q;
    if (q.length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const id = setTimeout(() => {
      fetch(`/api/search-ticker?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((d) => {
          if (latestQuery.current === q) setSearchResults(Array.isArray(d) ? d : []);
        })
        .catch(() => {
          if (latestQuery.current === q) setSearchResults([]);
        })
        .finally(() => {
          if (latestQuery.current === q) setSearching(false);
        });
    }, 300);
    return () => clearTimeout(id);
  }, [query]);

  const openEditor = () => {
    setDraft(myTickers || []);
    setQuery("");
    setSearchResults([]);
    setEditing(true);
  };

  const addTicker = (ticker) =>
    setDraft((prev) => (prev.includes(ticker) ? prev : [...prev, ticker]));

  const removeTicker = (ticker) =>
    setDraft((prev) => prev.filter((t) => t !== ticker));

  const toggleTicker = (ticker) =>
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

      {loadingRows && rows.length === 0 ? (
        <div className="flex items-center justify-center h-64 text-text-sec text-sm">
          Cargando precios...
        </div>
      ) : rows.length === 0 ? (
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
              {rows.map((item, i) => (
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
            className="bg-card border border-border rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <span className="text-[16px] font-semibold text-white">Editar instrumentos</span>
              <span className="text-xs text-text-dim">{draft.length} seleccionados</span>
            </div>

            {/* Chips de seleccionados */}
            {draft.length > 0 && (
              <div className="px-5 pt-3 flex flex-wrap gap-1.5">
                {draft.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1.5 bg-white/10 border border-white/20 rounded-full pl-2.5 pr-1.5 py-1 text-xs text-white"
                  >
                    <span className="font-mono">{t}</span>
                    <button
                      onClick={() => removeTicker(t)}
                      className="w-4 h-4 flex items-center justify-center rounded-full hover:bg-white/20 text-text-sec hover:text-white"
                      aria-label={`Quitar ${t}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Buscador */}
            <div className="px-5 pt-3">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar ticker o nombre (ej: AAPL, SPY, AMZN...)"
                className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-white/30"
              />
              {query.trim().length >= 2 && (
                <div className="mt-1 border border-border rounded-lg overflow-hidden max-h-52 overflow-y-auto bg-bg">
                  {searching ? (
                    <div className="px-3 py-2 text-xs text-text-dim">Buscando...</div>
                  ) : searchResults.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-text-dim">Sin resultados</div>
                  ) : (
                    searchResults.map((r) => {
                      const added = draft.includes(r.ticker);
                      return (
                        <button
                          key={r.ticker}
                          onClick={() => addTicker(r.ticker)}
                          disabled={added}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-card-hover transition disabled:opacity-50"
                        >
                          <span className="text-accent font-mono">{r.ticker}</span>
                          <span className="text-text-sec truncate flex-1">{r.name}</span>
                          {added && <span className="text-pos text-xs">✓</span>}
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            {/* Listado existente por categoría */}
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
                            onChange={() => toggleTicker(it.ticker)}
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
