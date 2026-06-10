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

const TOTAL_COLS = 4 + COLS.length;

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

function cloneGroups(groups) {
  return (groups || []).map((g) => ({
    label: g.label || "Sin nombre",
    tickers: Array.isArray(g.tickers) ? [...g.tickers] : [],
  }));
}

export default function MyTracker({ quotes, myGroups, setMyGroups }) {
  const [rowMap, setRowMap] = useState({});
  const [loadingRows, setLoadingRows] = useState(false);
  const [collapsed, setCollapsed] = useState({});

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState([]);
  const [saving, setSaving] = useState(false);
  const [targetGroup, setTargetGroup] = useState(0);

  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const latestQuery = useRef("");

  const groups = myGroups || [];
  const allTickers = [...new Set(groups.flatMap((g) => g.tickers))];
  const hasAnyTicker = allTickers.length > 0;

  // Traer precios/cambios de todos los tickers del usuario
  useEffect(() => {
    if (!allTickers.length) {
      setRowMap({});
      return;
    }
    let cancelled = false;
    setLoadingRows(true);
    fetch(`/api/ticker-quotes?symbols=${encodeURIComponent(allTickers.join(","))}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const map = {};
        for (const row of d.rows || []) map[row.ticker] = row;
        setRowMap(map);
      })
      .catch(() => {
        if (!cancelled) setRowMap({});
      })
      .finally(() => {
        if (!cancelled) setLoadingRows(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allTickers.join(",")]);

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

  const getRow = (ticker) =>
    rowMap[ticker] || { ticker, name: ticker, price: null, yearHigh: null };

  const toggleCollapse = (idx) =>
    setCollapsed((prev) => ({ ...prev, [idx]: !prev[idx] }));

  // ---------- edición ----------
  const openEditor = () => {
    const d = cloneGroups(myGroups);
    setDraft(d.length ? d : [{ label: "Mi Tracker", tickers: [] }]);
    setTargetGroup(0);
    setQuery("");
    setSearchResults([]);
    setEditing(true);
  };

  const addGroup = () =>
    setDraft((prev) => [...prev, { label: `Grupo ${prev.length + 1}`, tickers: [] }]);

  const renameGroup = (idx, label) =>
    setDraft((prev) => prev.map((g, i) => (i === idx ? { ...g, label } : g)));

  const deleteGroup = (idx) => {
    setDraft((prev) => prev.filter((_, i) => i !== idx));
    setTargetGroup((t) => (t >= idx && t > 0 ? t - 1 : t));
  };

  const addTickerToGroup = (idx, ticker) =>
    setDraft((prev) =>
      prev.map((g, i) =>
        i === idx && !g.tickers.includes(ticker)
          ? { ...g, tickers: [...g.tickers, ticker] }
          : g
      )
    );

  const removeTickerFromGroup = (idx, ticker) =>
    setDraft((prev) =>
      prev.map((g, i) =>
        i === idx ? { ...g, tickers: g.tickers.filter((t) => t !== ticker) } : g
      )
    );

  const moveTicker = (fromIdx, ticker, toIdx) => {
    if (fromIdx === toIdx) return;
    setDraft((prev) =>
      prev.map((g, i) => {
        if (i === fromIdx) return { ...g, tickers: g.tickers.filter((t) => t !== ticker) };
        if (i === toIdx && !g.tickers.includes(ticker))
          return { ...g, tickers: [...g.tickers, ticker] };
        return g;
      })
    );
  };

  const save = async () => {
    setSaving(true);
    try {
      const cleaned = draft.map((g) => ({
        label: g.label.trim() || "Sin nombre",
        tickers: g.tickers,
      }));
      const res = await fetch("/api/user-tracker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groups: cleaned }),
      });
      if (!res.ok) throw new Error("save failed");
      setMyGroups(cleaned);
      setEditing(false);
    } catch (e) {
      console.error("Error guardando tracker:", e);
      alert("No se pudo guardar. Intentá de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  const safeTarget = Math.min(targetGroup, Math.max(0, draft.length - 1));

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

      {myGroups === null || (loadingRows && !Object.keys(rowMap).length) ? (
        <div className="flex items-center justify-center h-64 text-text-sec text-sm">
          Cargando precios...
        </div>
      ) : !hasAnyTicker ? (
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
              {groups.map((group, gIdx) => {
                if (!group.tickers.length) return null;
                const isOpen = !collapsed[gIdx];
                return (
                  <React.Fragment key={`${group.label}-${gIdx}`}>
                    <tr onClick={() => toggleCollapse(gIdx)} className="cursor-pointer hover:bg-card-hover">
                      <td colSpan={TOTAL_COLS} className="px-3 py-2 bg-card-alt border-b border-border">
                        <span className="text-[10px] font-bold text-accent uppercase tracking-[0.15em]">
                          <span className="text-text-dim text-[8px] mr-1.5">{isOpen ? "▼" : "▶"}</span>
                          {group.label}
                        </span>
                        <span className="text-[10px] text-text-dim ml-2 font-normal">{group.tickers.length}</span>
                      </td>
                    </tr>
                    {isOpen &&
                      group.tickers.map((ticker, i) => {
                        const item = getRow(ticker);
                        return (
                          <tr key={`${gIdx}-${ticker}`} className={`border-b border-border hover:bg-card-hover ${i % 2 === 0 ? "" : "bg-white/[0.01]"}`}>
                            <td className="px-3 py-2 text-[14px] font-medium text-white">{item.name}</td>
                            <td className="px-2 py-2 text-[14px] text-accent font-mono font-medium">{item.ticker}</td>
                            <td className="px-2 py-2 text-center text-[14px] text-white font-semibold font-mono">{fmtPrice(item.price)}</td>
                            <td className="px-2 py-2 text-center text-[14px] text-white font-mono">{fmtPrice(item.yearHigh)}</td>
                            {COLS.map((c) => (
                              <HeatCell key={c.key} val={item[c.key]} />
                            ))}
                          </tr>
                        );
                      })}
                  </React.Fragment>
                );
              })}
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
            className="bg-card border border-border rounded-xl w-full max-w-2xl max-h-[88vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <span className="text-[16px] font-semibold text-white">Editar grupos</span>
              <button
                onClick={addGroup}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/10 border border-white/30 text-white hover:bg-white/20 transition"
              >
                + Nuevo grupo
              </button>
            </div>

            {/* Buscador con grupo destino */}
            <div className="px-5 pt-3">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xs text-text-sec whitespace-nowrap">Agregar a:</span>
                <select
                  value={safeTarget}
                  onChange={(e) => setTargetGroup(Number(e.target.value))}
                  disabled={!draft.length}
                  className="bg-bg border border-border rounded-lg px-2 py-1.5 text-sm text-white outline-none flex-1 disabled:opacity-50"
                >
                  {draft.map((g, i) => (
                    <option key={i} value={i}>{g.label || `Grupo ${i + 1}`}</option>
                  ))}
                </select>
              </div>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar ticker o nombre (ej: AAPL, SPY, AMZN...)"
                disabled={!draft.length}
                className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-white/30 disabled:opacity-50"
              />
              {!draft.length && (
                <div className="text-xs text-text-dim mt-1">Creá un grupo primero para agregar instrumentos.</div>
              )}
              {query.trim().length >= 2 && draft.length > 0 && (
                <div className="mt-1 border border-border rounded-lg overflow-hidden max-h-44 overflow-y-auto bg-bg">
                  {searching ? (
                    <div className="px-3 py-2 text-xs text-text-dim">Buscando...</div>
                  ) : searchResults.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-text-dim">Sin resultados</div>
                  ) : (
                    searchResults.map((r) => {
                      const added = draft[safeTarget]?.tickers.includes(r.ticker);
                      return (
                        <button
                          key={r.ticker}
                          onClick={() => addTickerToGroup(safeTarget, r.ticker)}
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

            {/* Grupos */}
            <div className="overflow-y-auto px-5 py-3 flex-1 space-y-4">
              {draft.map((group, gIdx) => (
                <div key={gIdx} className="border border-border rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      type="text"
                      value={group.label}
                      onChange={(e) => renameGroup(gIdx, e.target.value)}
                      placeholder="Nombre del grupo"
                      className="flex-1 bg-bg border border-border rounded-lg px-2.5 py-1.5 text-sm font-semibold text-white outline-none focus:border-white/30"
                    />
                    <span className="text-[10px] text-text-dim">{group.tickers.length}</span>
                    <button
                      onClick={() => deleteGroup(gIdx)}
                      className="px-2 py-1.5 rounded-lg text-xs text-neg hover:bg-white/5 transition"
                      title="Eliminar grupo"
                    >
                      Eliminar
                    </button>
                  </div>
                  {group.tickers.length === 0 ? (
                    <div className="text-xs text-text-dim px-1 py-2">Sin instrumentos. Usá el buscador de arriba.</div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {group.tickers.map((t) => (
                        <span
                          key={t}
                          className="inline-flex items-center gap-1.5 bg-white/10 border border-white/20 rounded-full pl-2.5 pr-1 py-1 text-xs text-white"
                        >
                          <span className="font-mono">{t}</span>
                          {draft.length > 1 && (
                            <select
                              value=""
                              onChange={(e) => {
                                if (e.target.value !== "") moveTicker(gIdx, t, Number(e.target.value));
                              }}
                              className="bg-transparent text-text-sec text-[10px] outline-none cursor-pointer"
                              title="Mover a otro grupo"
                            >
                              <option value="">↔</option>
                              {draft.map((g2, j) =>
                                j === gIdx ? null : (
                                  <option key={j} value={j} className="bg-card text-white">
                                    → {g2.label || `Grupo ${j + 1}`}
                                  </option>
                                )
                              )}
                            </select>
                          )}
                          <button
                            onClick={() => removeTickerFromGroup(gIdx, t)}
                            className="w-4 h-4 flex items-center justify-center rounded-full hover:bg-white/20 text-text-sec hover:text-white"
                            aria-label={`Quitar ${t}`}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {draft.length === 0 && (
                <div className="text-sm text-text-sec text-center py-6">
                  No hay grupos. Tocá “+ Nuevo grupo” para empezar.
                </div>
              )}
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
