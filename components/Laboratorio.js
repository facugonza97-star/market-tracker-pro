"use client";
import { useState, useEffect, useMemo, useRef } from "react";
import {
  ResponsiveContainer, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, ReferenceLine, Tooltip,
} from "recharts";
import {
  LAB_GROUPS, LAB_PRESETS, DEFAULT_PRESET, MAX_ASSETS,
  labName, isLabTicker,
} from "@/lib/labUniverse";
import {
  buildAligned, correlationMatrix, rollingCorrelation,
  windowSeries, drawdownSeries, drawdownMetrics, worstEpisodes,
} from "@/lib/labStats";

const AMBER = "#F8A11E";
const ACCENT = "#5B8DEF";
const MINT = "#4AF6C3";
const VIOLET = "#B48EF7";
const GRAY = "#A0AEC0";
const NAVY = "#031D38";
const LINE_COLORS = ["#FFFFFF", AMBER, ACCENT, MINT, VIOLET, GRAY];

const CORR_WINDOWS = ["6M", "1A", "3A", "5A", "Máx"];
const FREQS = [
  { key: "D", label: "Diaria" },
  { key: "W", label: "Semanal" },
  { key: "M", label: "Mensual" },
];
const ROLL_WINDOWS = { D: [30, 60, 90, 120, 250], W: [13, 26, 52], M: [12, 24, 36] };
const ROLL_DEFAULT = { D: 60, W: 26, M: 24 };
const DD_WINDOWS = ["1A", "3A", "5A", "10A", "Máx"];

function presetTickers(key) {
  return LAB_PRESETS.find((p) => p.key === key)?.tickers || [];
}
function fmtPct(v, dec = 1) {
  if (v == null || !isFinite(v)) return "-";
  return (v > 0 ? "+" : "") + (v * 100).toFixed(dec).replace(".", ",") + "%";
}
function fmtDate(d) {
  if (!d) return "-";
  return new Date(d + "T00:00:00Z").toLocaleDateString("es-UY", { day: "2-digit", month: "short", year: "numeric" });
}

// matrix cell background: accent (blue) for positive, amber for negative
function cellBg(v) {
  if (v == null) return "transparent";
  const a = Math.min(Math.abs(v), 1) * 0.85;
  const c = v >= 0 ? "91,141,239" : "248,161,30";
  return `rgba(${c},${a.toFixed(3)})`;
}

const btn = (on) =>
  `px-3 py-1.5 rounded text-[13px] font-semibold transition border ${
    on ? "border-white/30 text-white" : "border-border text-text-sec hover:text-white"
  }`;

export default function Laboratorio() {
  const [view, setView] = useState("corr");
  const [selected, setSelected] = useState(() => presetTickers(DEFAULT_PRESET));
  const [seriesMap, setSeriesMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [lastDate, setLastDate] = useState(null);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  // correlation controls
  const [corrWin, setCorrWin] = useState("3A");
  const [freq, setFreq] = useState("W");
  const [rollWin, setRollWin] = useState(ROLL_DEFAULT.W);
  const [pairA, setPairA] = useState("SPY");
  const [pairB, setPairB] = useState("TLT");

  // drawdown controls
  const [ddWin, setDdWin] = useState("5A");
  const [hidden, setHidden] = useState(new Set());
  const [worstTicker, setWorstTicker] = useState(null);

  // fetch missing series whenever selection grows
  useEffect(() => {
    const missing = selected.filter((t) => !seriesMap[t]);
    if (!missing.length) return;
    setLoading(true);
    setError(false);
    fetch(`/api/lab-history?tickers=${missing.join(",")}&years=10`)
      .then((r) => r.json())
      .then((d) => {
        if (d?.series) {
          setSeriesMap((prev) => ({ ...prev, ...d.series }));
          if (d.lastDate) setLastDate(d.lastDate);
        } else setError(true);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [selected]); // eslint-disable-line react-hooks/exhaustive-deps

  // keep rolling window valid when frequency changes
  useEffect(() => {
    if (!ROLL_WINDOWS[freq].includes(rollWin)) setRollWin(ROLL_DEFAULT[freq]);
  }, [freq]); // eslint-disable-line react-hooks/exhaustive-deps

  // keep pair selectors within the selection
  useEffect(() => {
    if (!selected.includes(pairA)) setPairA(selected[0] || "");
    if (!selected.includes(pairB)) setPairB(selected[1] || selected[0] || "");
    if (worstTicker && !selected.includes(worstTicker)) setWorstTicker(selected[0] || null);
  }, [selected]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onClick = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const ready = selected.every((t) => seriesMap[t]);

  const addTicker = (t) => {
    if (!isLabTicker(t) || selected.includes(t) || selected.length >= MAX_ASSETS) return;
    setSelected((s) => [...s, t]);
    setSearch("");
  };
  const removeTicker = (t) => setSelected((s) => s.filter((x) => x !== t));
  const applyPreset = (key) => { setSelected(presetTickers(key)); setHidden(new Set()); };

  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    return LAB_GROUPS.map((g) => ({
      group: g.group,
      assets: g.assets.filter(
        (a) => !selected.includes(a.ticker) &&
          (!q || a.ticker.toLowerCase().includes(q) || a.name.toLowerCase().includes(q))
      ),
    })).filter((g) => g.assets.length);
  }, [search, selected]);

  // ---- correlation data ----
  const aligned = useMemo(
    () => (ready && selected.length ? buildAligned(seriesMap, selected, freq, corrWin) : null),
    [ready, seriesMap, selected, freq, corrWin]
  );
  const matrix = useMemo(() => (aligned ? correlationMatrix(aligned) : null), [aligned]);
  const rolling = useMemo(
    () => (ready && pairA && pairB && seriesMap[pairA] && seriesMap[pairB]
      ? rollingCorrelation(seriesMap, pairA, pairB, freq, corrWin, rollWin)
      : null),
    [ready, seriesMap, pairA, pairB, freq, corrWin, rollWin]
  );

  // ---- drawdown data (daily) ----
  const ddAssets = useMemo(() => {
    if (!ready) return [];
    return selected.map((t) => {
      const w = windowSeries(seriesMap[t], "D", ddWin);
      return { ticker: t, name: labName(t), series: w, dd: drawdownSeries(w), metrics: drawdownMetrics(w, "D") };
    });
  }, [ready, seriesMap, selected, ddWin]);

  const underwaterData = useMemo(() => {
    if (!ddAssets.length) return [];
    const visible = ddAssets.filter((a) => !hidden.has(a.ticker)).slice(0, 6);
    const map = new Map();
    for (const a of visible) {
      for (const [date, v] of a.dd) {
        if (!map.has(date)) map.set(date, { date });
        map.get(date)[a.ticker] = +(v * 100).toFixed(2);
      }
    }
    return [...map.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
  }, [ddAssets, hidden]);

  const visibleDD = ddAssets.filter((a) => !hidden.has(a.ticker)).slice(0, 6);
  const singleDD = visibleDD.length === 1;
  const worst = useMemo(() => {
    const t = worstTicker || selected[0];
    const a = ddAssets.find((x) => x.ticker === t);
    return a ? { ticker: t, name: labName(t), episodes: worstEpisodes(a.series, 5) } : null;
  }, [worstTicker, selected, ddAssets]);

  return (
    <div className="px-6 py-5">
      <style>{`.lab-row:hover{background:#1a2f52;} .lab-cellhover:hover{outline:1px solid rgba(255,255,255,.4);cursor:pointer;}`}</style>

      {/* eyebrow */}
      <div className="flex items-center gap-2.5 mb-3">
        <span className="w-[3px] h-3.5 rounded-full bg-accent" />
        <span className="text-[13px] font-bold text-accent uppercase tracking-[0.14em]">Laboratorio</span>
      </div>

      {/* view selector */}
      <div className="flex gap-1 mb-4">
        {[{ k: "corr", l: "Correlaciones" }, { k: "dd", l: "Drawdowns" }].map((v) => (
          <button key={v.k} onClick={() => setView(v.k)} className={btn(view === v.k)}
            style={view === v.k ? { background: "rgba(248,161,30,.12)", borderColor: "rgba(248,161,30,.6)", color: AMBER } : { background: "#0d0d1a" }}>
            {v.l}
          </button>
        ))}
      </div>

      {/* shared asset selector */}
      <div className="mb-4">
        <div className="flex flex-wrap gap-1.5 mb-2">
          {LAB_PRESETS.map((p) => (
            <button key={p.key} onClick={() => applyPreset(p.key)} className={btn(false)} style={{ background: "#0d0d1a" }}>
              {p.key}
            </button>
          ))}
        </div>
        <div ref={boxRef} className="relative" style={{ maxWidth: 560 }}>
          <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-md border border-border bg-card">
            {selected.map((t) => (
              <span key={t} className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-white/10 text-[13px] text-white">
                <span className="font-semibold">{t}</span>
                <span className="text-text-sec">{labName(t)}</span>
                <button onClick={() => removeTicker(t)} className="text-text-sec hover:text-white ml-0.5">×</button>
              </span>
            ))}
            {selected.length < MAX_ASSETS && (
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onFocus={() => setOpen(true)}
                placeholder={selected.length ? "Agregar…" : "Buscar activo…"}
                className="flex-1 min-w-[120px] bg-transparent outline-none text-[14px] text-white placeholder:text-text-dim px-1"
              />
            )}
          </div>
          <div className="text-[12px] text-text-dim mt-1">{selected.length}/{MAX_ASSETS} activos</div>
          {open && filteredGroups.length > 0 && (
            <div className="absolute z-20 mt-1 w-full max-h-72 overflow-auto rounded-md border border-border bg-card shadow-xl">
              {filteredGroups.map((g) => (
                <div key={g.group}>
                  <div className="px-3 py-1.5 text-[12px] font-bold text-accent uppercase tracking-wider bg-black/40 sticky top-0">{g.group}</div>
                  {g.assets.map((a) => (
                    <button key={a.ticker} onClick={() => addTicker(a.ticker)}
                      className="w-full text-left px-3 py-1.5 flex justify-between items-center hover:bg-white/10"
                      disabled={selected.length >= MAX_ASSETS}>
                      <span className="text-[14px] text-white">{a.name}</span>
                      <span className="text-[13px] font-mono text-text-sec">{a.ticker}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {loading && !ready && <div className="text-sm text-text-sec h-40 flex items-center justify-center">Cargando series…</div>}
      {error && <div className="text-sm text-neg h-10 flex items-center">No se pudieron cargar algunas series.</div>}

      {ready && selected.length > 0 && view === "corr" && (
        <CorrView {...{ aligned, matrix, rolling, corrWin, setCorrWin, freq, setFreq, rollWin, setRollWin, pairA, setPairA, pairB, setPairB, selected }} />
      )}

      {ready && selected.length > 0 && view === "dd" && (
        <DdView {...{ ddAssets, underwaterData, visibleDD, singleDD, hidden, setHidden, ddWin, setDdWin, worst, worstTicker, setWorstTicker, selected }} />
      )}

      <div className="text-[12px] text-text-dim mt-6 leading-relaxed border-t border-border pt-3">
        Retornos totales en USD (precio ajustado por dividendos). Las correlaciones cambian con el período y la frecuencia, y no predicen el futuro.
      </div>
    </div>
  );
}

// ======================= Correlations view =======================
function CorrView({ aligned, matrix, rolling, corrWin, setCorrWin, freq, setFreq, rollWin, setRollWin, pairA, setPairA, pairB, setPairB, selected }) {
  const tickers = aligned?.tickers || [];
  const freqLabel = FREQS.find((f) => f.key === freq)?.label;
  return (
    <>
      <div className="flex flex-wrap gap-4 mb-3">
        <div className="flex flex-wrap gap-1">
          {CORR_WINDOWS.map((w) => (
            <button key={w} onClick={() => setCorrWin(w)} className={btn(w === corrWin)}
              style={w === corrWin ? { background: "rgba(248,161,30,.12)", borderColor: "rgba(248,161,30,.6)", color: AMBER } : { background: "#0d0d1a" }}>{w}</button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1">
          {FREQS.map((f) => (
            <button key={f.key} onClick={() => setFreq(f.key)} className={btn(f.key === freq)}
              style={f.key === freq ? { background: "rgba(248,161,30,.12)", borderColor: "rgba(248,161,30,.6)", color: AMBER } : { background: "#0d0d1a" }}>{f.label}</button>
          ))}
        </div>
      </div>

      {aligned && (
        <div className="text-[13px] text-text-sec mb-1">
          Datos comunes: desde <span className="text-white font-semibold">{fmtDate(aligned.firstDate)}</span>, n=<span className="text-white font-semibold">{aligned.n}</span> observaciones ({freqLabel.toLowerCase()}) · limitado por <span className="text-white font-semibold">{labName(aligned.limitedBy)}</span>
        </div>
      )}
      {aligned && aligned.n < 30 && (
        <div className="text-[13px] mb-2" style={{ color: AMBER }}>⚠ Pocos datos (n={aligned.n}); la correlación es poco confiable.</div>
      )}

      {/* matrix */}
      <div className="overflow-x-auto mb-5 mt-2">
        <table className="border-separate" style={{ borderSpacing: 2 }}>
          <thead>
            <tr>
              <th className="sticky left-0 bg-bg" style={{ minWidth: 120 }} />
              {tickers.map((t) => (
                <th key={t} className="text-[13px] font-mono text-text-sec font-semibold px-2 pb-1" style={{ minWidth: 48 }}>{t}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tickers.map((rt, i) => (
              <tr key={rt}>
                <td className="sticky left-0 bg-bg text-[14px] text-white whitespace-nowrap pr-3" style={{ minWidth: 120 }}>
                  <span className="font-mono text-text-sec mr-1.5">{rt}</span>{labName(rt)}
                </td>
                {tickers.map((ct, j) => {
                  const v = matrix[i][j];
                  const diag = i === j;
                  return (
                    <td key={ct} onClick={() => { if (!diag) { setPairA(rt); setPairB(ct); } }}
                      className={`text-center font-mono text-white ${diag ? "" : "lab-cellhover"}`}
                      style={{ minWidth: 48, height: 32, background: diag ? "rgba(255,255,255,.05)" : cellBg(v), fontSize: 14, color: diag ? "#64748B" : "#fff", borderRadius: 3 }}>
                      {v == null ? "-" : v.toFixed(2)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* legend */}
      <div className="flex items-center gap-3 mb-6 text-[12px] text-text-sec">
        <span>-1</span>
        <div style={{ width: 220, height: 12, borderRadius: 3, background: `linear-gradient(90deg, rgba(248,161,30,.85), #0d0d1a, rgba(91,141,239,.85))` }} />
        <span>+1</span>
        <span className="ml-2 text-text-dim">ámbar = negativa · azul = positiva</span>
      </div>

      {/* rolling correlation */}
      <div className="flex flex-wrap items-center gap-3 mb-2">
        <span className="text-[13px] font-bold text-accent uppercase tracking-wider">Correlación móvil</span>
        <PairSelect value={pairA} onChange={setPairA} options={selected} label="A" />
        <PairSelect value={pairB} onChange={setPairB} options={selected} label="B" />
        <div className="flex gap-1">
          {ROLL_WINDOWS[freq].map((w) => (
            <button key={w} onClick={() => setRollWin(w)} className={btn(w === rollWin)}
              style={w === rollWin ? { background: "rgba(248,161,30,.12)", borderColor: "rgba(248,161,30,.6)", color: AMBER } : { background: "#0d0d1a" }}>
              {w}{freq === "D" ? "d" : freq === "W" ? "s" : "m"}
            </button>
          ))}
        </div>
      </div>
      <div style={{ background: "#000", borderRadius: 6, padding: "10px 8px 4px" }}>
        {rolling && rolling.points.length ? (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={rolling.points} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
              <CartesianGrid stroke="rgba(255,255,255,.15)" strokeDasharray="2 3" />
              <XAxis dataKey="date" tick={{ fill: "#94A3B8", fontSize: 12 }} tickFormatter={(d) => d?.slice(0, 7)} minTickGap={40} />
              <YAxis domain={[-1, 1]} ticks={[-1, -0.5, 0, 0.5, 1]} tick={{ fill: "#94A3B8", fontSize: 12 }} width={38} />
              <ReferenceLine y={0} stroke="rgba(255,255,255,.4)" />
              {rolling.avg != null && <ReferenceLine y={rolling.avg} stroke={AMBER} strokeDasharray="5 4" label={{ value: `prom ${rolling.avg.toFixed(2)}`, fill: AMBER, fontSize: 11, position: "insideTopRight" }} />}
              <Tooltip contentStyle={{ background: "#0d0d1a", border: "1px solid #1C2536", fontSize: 12 }} labelStyle={{ color: "#94A3B8" }} formatter={(v) => [v.toFixed(2), `${pairA}/${pairB}`]} />
              <Line type="monotone" dataKey="value" stroke="#fff" strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[240px] flex items-center justify-center text-text-sec text-sm">Sin datos suficientes para la ventana elegida.</div>
        )}
      </div>
    </>
  );
}

function PairSelect({ value, onChange, options, label }) {
  return (
    <label className="flex items-center gap-1.5 text-[13px] text-text-sec">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="bg-card border border-border rounded px-2 py-1 text-[13px] text-white font-mono">
        {options.map((t) => <option key={t} value={t}>{t}</option>)}
      </select>
    </label>
  );
}

// ======================= Drawdowns view =======================
function DdView({ ddAssets, underwaterData, visibleDD, singleDD, hidden, setHidden, ddWin, setDdWin, worst, worstTicker, setWorstTicker, selected }) {
  const colorOf = (ticker) => {
    const idx = visibleDD.findIndex((a) => a.ticker === ticker);
    return idx >= 0 ? LINE_COLORS[idx % LINE_COLORS.length] : GRAY;
  };
  const toggle = (t) => setHidden((h) => { const n = new Set(h); n.has(t) ? n.delete(t) : n.add(t); return n; });

  return (
    <>
      <div className="flex flex-wrap gap-1 mb-3">
        {DD_WINDOWS.map((w) => (
          <button key={w} onClick={() => setDdWin(w)} className={btn(w === ddWin)}
            style={w === ddWin ? { background: "rgba(248,161,30,.12)", borderColor: "rgba(248,161,30,.6)", color: AMBER } : { background: "#0d0d1a" }}>{w}</button>
        ))}
      </div>

      {/* legend (clickable) */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mb-2">
        {ddAssets.slice(0, 6).map((a) => {
          const off = hidden.has(a.ticker);
          return (
            <button key={a.ticker} onClick={() => toggle(a.ticker)} className="flex items-center gap-1.5 text-[13px]" style={{ opacity: off ? 0.4 : 1 }}>
              <span style={{ width: 14, height: 3, background: colorOf(a.ticker), display: "inline-block", borderRadius: 2 }} />
              <span className="text-white">{a.name}</span>
              <span className="font-mono text-text-sec">{a.ticker}</span>
            </button>
          );
        })}
        {ddAssets.length > 6 && <span className="text-[12px] text-text-dim self-center">(se muestran hasta 6)</span>}
      </div>

      {/* underwater chart */}
      <div style={{ background: "#000", borderRadius: 6, padding: "10px 8px 4px" }}>
        <ResponsiveContainer width="100%" height={280}>
          {singleDD ? (
            <AreaChart data={underwaterData} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
              <CartesianGrid stroke="rgba(255,255,255,.15)" strokeDasharray="2 3" />
              <XAxis dataKey="date" tick={{ fill: "#94A3B8", fontSize: 12 }} tickFormatter={(d) => d?.slice(0, 7)} minTickGap={40} />
              <YAxis tick={{ fill: "#94A3B8", fontSize: 12 }} width={44} tickFormatter={(v) => v + "%"} />
              <ReferenceLine y={0} stroke="rgba(255,255,255,.4)" />
              <Tooltip contentStyle={{ background: "#0d0d1a", border: "1px solid #1C2536", fontSize: 12 }} labelStyle={{ color: "#94A3B8" }} formatter={(v) => [v.toFixed(2) + "%", visibleDD[0].ticker]} />
              <Area type="monotone" dataKey={visibleDD[0].ticker} stroke="#fff" strokeWidth={1.5} fill={NAVY} fillOpacity={1} />
            </AreaChart>
          ) : (
            <LineChart data={underwaterData} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
              <CartesianGrid stroke="rgba(255,255,255,.15)" strokeDasharray="2 3" />
              <XAxis dataKey="date" tick={{ fill: "#94A3B8", fontSize: 12 }} tickFormatter={(d) => d?.slice(0, 7)} minTickGap={40} />
              <YAxis tick={{ fill: "#94A3B8", fontSize: 12 }} width={44} tickFormatter={(v) => v + "%"} />
              <ReferenceLine y={0} stroke="rgba(255,255,255,.4)" />
              <Tooltip contentStyle={{ background: "#0d0d1a", border: "1px solid #1C2536", fontSize: 12 }} labelStyle={{ color: "#94A3B8" }} formatter={(v, n) => [v.toFixed(2) + "%", n]} />
              {visibleDD.map((a) => (
                <Line key={a.ticker} type="monotone" dataKey={a.ticker} stroke={colorOf(a.ticker)} strokeWidth={1.4} dot={false} />
              ))}
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* summary table */}
      <div className="overflow-x-auto mt-5">
        <table className="w-full" style={{ minWidth: 820 }}>
          <thead>
            <tr className="text-[13px] text-text-sec text-left border-b border-border">
              <th className="py-2 pr-3 font-semibold">Activo</th>
              <th className="py-2 px-2 font-semibold text-right">Retorno</th>
              <th className="py-2 px-2 font-semibold text-right">Vol. anual.</th>
              <th className="py-2 px-2 font-semibold text-right">Max DD</th>
              <th className="py-2 px-2 font-semibold text-right">Pico</th>
              <th className="py-2 px-2 font-semibold text-right">Valle</th>
              <th className="py-2 px-2 font-semibold text-right">Recuperación</th>
              <th className="py-2 px-2 font-semibold text-right">Días</th>
              <th className="py-2 px-2 font-semibold text-right">DD actual</th>
            </tr>
          </thead>
          <tbody>
            {ddAssets.map((a) => {
              const m = a.metrics;
              return (
                <tr key={a.ticker} className="lab-row border-b border-border/40" style={{ height: 30 }}>
                  <td className="py-1 pr-3 text-[14px] text-white whitespace-nowrap"><span className="font-mono text-text-sec mr-1.5">{a.ticker}</span>{a.name}</td>
                  <td className="py-1 px-2 text-right font-mono text-[14px]" style={{ color: m && m.totalReturn >= 0 ? MINT : NEG_C }}>{m ? fmtPct(m.totalReturn) : "-"}</td>
                  <td className="py-1 px-2 text-right font-mono text-[14px] text-white">{m ? (m.volAnn * 100).toFixed(1).replace(".", ",") + "%" : "-"}</td>
                  <td className="py-1 px-2 text-right font-mono text-[14px]" style={{ color: NEG_C }}>{m ? fmtPct(m.maxDD) : "-"}</td>
                  <td className="py-1 px-2 text-right font-mono text-[13px] text-text-sec">{m ? fmtDate(m.peakDate) : "-"}</td>
                  <td className="py-1 px-2 text-right font-mono text-[13px] text-text-sec">{m ? fmtDate(m.troughDate) : "-"}</td>
                  <td className="py-1 px-2 text-right font-mono text-[13px]" style={{ color: m && m.recoveryDate ? "#cbd5e1" : AMBER }}>{m ? (m.recoveryDate ? fmtDate(m.recoveryDate) : "No recuperado") : "-"}</td>
                  <td className="py-1 px-2 text-right font-mono text-[13px] text-text-sec">{m && m.daysToRecovery != null ? m.daysToRecovery : "-"}</td>
                  <td className="py-1 px-2 text-right font-mono text-[14px]" style={{ color: m && m.currentDD < -0.001 ? NEG_C : "#64748B" }}>{m ? fmtPct(m.currentDD) : "-"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* worst episodes */}
      <div className="mt-6">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-[13px] font-bold text-accent uppercase tracking-wider">Peores caídas</span>
          <select value={worstTicker || selected[0]} onChange={(e) => setWorstTicker(e.target.value)}
            className="bg-card border border-border rounded px-2 py-1 text-[13px] text-white font-mono">
            {selected.map((t) => <option key={t} value={t}>{t} · {labName(t)}</option>)}
          </select>
        </div>
        {worst && worst.episodes.length ? (
          <div className="overflow-x-auto">
            <table className="w-full" style={{ minWidth: 560 }}>
              <thead>
                <tr className="text-[13px] text-text-sec text-left border-b border-border">
                  <th className="py-2 pr-3 font-semibold">#</th>
                  <th className="py-2 px-2 font-semibold text-right">Profundidad</th>
                  <th className="py-2 px-2 font-semibold text-right">Pico</th>
                  <th className="py-2 px-2 font-semibold text-right">Valle</th>
                  <th className="py-2 px-2 font-semibold text-right">Recuperación</th>
                </tr>
              </thead>
              <tbody>
                {worst.episodes.map((e, i) => (
                  <tr key={i} className="lab-row border-b border-border/40" style={{ height: 30 }}>
                    <td className="py-1 pr-3 text-[14px] text-text-sec font-mono">{i + 1}</td>
                    <td className="py-1 px-2 text-right font-mono text-[14px]" style={{ color: NEG_C }}>{fmtPct(e.depth)}</td>
                    <td className="py-1 px-2 text-right font-mono text-[13px] text-text-sec">{fmtDate(e.peakDate)}</td>
                    <td className="py-1 px-2 text-right font-mono text-[13px] text-text-sec">{fmtDate(e.troughDate)}</td>
                    <td className="py-1 px-2 text-right font-mono text-[13px]" style={{ color: e.recoveryDate ? "#cbd5e1" : AMBER }}>{e.recoveryDate ? fmtDate(e.recoveryDate) : "No recuperado"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <div className="text-[13px] text-text-sec">Sin episodios en la ventana.</div>}
      </div>
    </>
  );
}

const NEG_C = "#FF433D";
