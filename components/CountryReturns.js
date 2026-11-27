"use client";
import { useState, useEffect, useMemo } from "react";
import { REGION_CHIPS } from "@/lib/countryEtfs";

const POS = "#4AF6C3";
const NEG = "#FF433D";
const AMBER = "#F8A11E";

// Moving-window periods + the 3 dynamic calendar years are appended at runtime.
const MOV_PERIODS = [
  { key: "1M", col: "m1" },
  { key: "3M", col: "m3" },
  { key: "6M", col: "m6" },
  { key: "YTD", col: "ytd" },
  { key: "1A", col: "y1" },
  { key: "3A", col: "y3" },
];

const BENCH_ORDER = ["VT", "SPY", "ACWX", "IEFA", "IEMG", "VGK", "EZU"];

// Layout widths (px) — kept in sync with the reference-line overlay offsets.
const W_RANK = 28;
const W_NAME = 132;
const W_TKR = 44;
const W_VAL = 54;

function fmt(v) {
  if (v === null || v === undefined) return "-";
  return (v > 0 ? "+" : "") + v.toFixed(1).replace(".", ",");
}
function tone(v) {
  if (v === null || v === undefined) return "#64748B";
  return v > 0 ? POS : v < 0 ? NEG : "#64748B";
}
function fmtDate(d) {
  if (!d) return "-";
  return new Date(d + "T00:00:00Z").toLocaleDateString("es-UY", { day: "2-digit", month: "short", year: "numeric" });
}

// Value of the active period for a row.
function valOf(row, period) {
  if (!row) return null;
  if (period.kind === "cal") return row.returns.cal?.[period.year] ?? null;
  return row.returns[period.col] ?? null;
}

export default function CountryReturns() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const [region, setRegion] = useState("Todos");
  const [periodKey, setPeriodKey] = useState("YTD");

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

  const periods = useMemo(() => {
    const cal = (data?.calYears || []).map((y) => ({ key: String(y), kind: "cal", year: y }));
    return [...MOV_PERIODS.map((p) => ({ ...p, kind: "mov" })), ...cal];
  }, [data]);

  const period = useMemo(
    () => periods.find((p) => p.key === periodKey) || periods[3] || periods[0],
    [periods, periodKey]
  );

  const aggregates = useMemo(() => (data?.rows || []).filter((r) => r.aggregate), [data]);
  const benchStrip = useMemo(
    () => BENCH_ORDER.map((t) => aggregates.find((r) => r.ticker === t)).filter(Boolean),
    [aggregates]
  );
  const spy = useMemo(() => aggregates.find((r) => r.ticker === "SPY"), [aggregates]);
  const vt = useMemo(() => aggregates.find((r) => r.ticker === "VT"), [aggregates]);

  const allCountries = useMemo(() => (data?.rows || []).filter((r) => !r.aggregate), [data]);

  // Single scale for all bars: largest |value| across ALL countries for this period.
  const maxAbs = useMemo(() => {
    if (!period) return 1;
    let m = 0;
    for (const r of allCountries) {
      const v = valOf(r, period);
      if (v != null) m = Math.max(m, Math.abs(v));
    }
    return m || 1;
  }, [allCountries, period]);

  const ranked = useMemo(() => {
    if (!period) return [];
    let list = allCountries.slice();
    if (region === "Latam") list = list.filter((r) => r.latam);
    else if (region !== "Todos") list = list.filter((r) => r.region === region);
    return list.sort((a, b) => {
      const av = valOf(a, period), bv = valOf(b, period);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      return bv - av;
    });
  }, [allCountries, region, period]);

  const pct = (v) => 50 + (v / maxAbs) * 50; // position across chart zone (0..100%)

  const spyV = period && spy ? valOf(spy, period) : null;
  const vtV = period && vt ? valOf(vt, period) : null;
  const spyX = spyV != null ? pct(spyV) : null;
  const vtX = vtV != null ? pct(vtV) : null;
  const stagger = spyX != null && vtX != null && Math.abs(spyX - vtX) < 8;

  return (
    <div className="px-6 py-5">
      <style>{`
        .cr-row:hover { background:#1a2f52; }
        @media (max-width: 640px) {
          .cr-name { width:92px !important; }
          .cr-tkr { display:none !important; }
          .cr-refwrap { margin-left:120px !important; }
        }
      `}</style>

      <div className="flex items-center gap-2.5 mb-3">
        <span className="w-[3px] h-3.5 rounded-full bg-accent" />
        <span className="text-[13px] font-bold text-accent uppercase tracking-[0.14em]">
          Global Equity ETFs - Total Returns (USD)
        </span>
      </div>

      {data === null && !error ? (
        <div className="text-sm text-text-sec h-64 flex items-center justify-center">Cargando retornos...</div>
      ) : error && data === null ? (
        <div className="text-sm text-text-sec h-64 flex items-center justify-center">No se pudieron cargar los retornos.</div>
      ) : (
        <>
          {/* Period selector */}
          <div className="flex flex-wrap gap-1 mb-3">
            {periods.map((p) => {
              const on = p.key === period?.key;
              return (
                <button
                  key={p.key}
                  onClick={() => setPeriodKey(p.key)}
                  className="px-2.5 py-1 rounded text-[11px] font-semibold transition border"
                  style={{
                    borderColor: on ? "rgba(248,161,30,.6)" : "#1C2536",
                    background: on ? "rgba(248,161,30,.12)" : "#0d0d1a",
                    color: on ? AMBER : "#94A3B8",
                  }}
                >
                  {p.key}
                </button>
              );
            })}
          </div>

          {/* Benchmark strip */}
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 mb-3 px-2.5 py-2 border border-border rounded-md">
            {benchStrip.map((b) => {
              const v = valOf(b, period);
              return (
                <span key={b.ticker} className="text-[11px] font-mono">
                  <span className="text-text-sec">{b.name}</span>{" "}
                  <span className="font-semibold" style={{ color: tone(v) }}>{fmt(v)}</span>
                </span>
              );
            })}
          </div>

          {/* Region chips */}
          <div className="flex flex-wrap gap-1.5 mb-2.5">
            {REGION_CHIPS.map((c) => {
              const on = c === region;
              return (
                <button
                  key={c}
                  onClick={() => setRegion(c)}
                  className={`px-2.5 py-1 rounded text-[11px] font-semibold transition border ${
                    on ? "bg-white/10 border-white/30 text-white" : "bg-card border-border text-text-sec hover:text-white"
                  }`}
                >
                  {c}
                </button>
              );
            })}
          </div>

          {/* Reference labels (EE.UU. / Mundo) aligned over the chart zone */}
          <div
            className="cr-refwrap relative mb-0.5"
            style={{ height: 16, marginLeft: W_RANK + W_NAME + W_TKR, marginRight: W_VAL }}
          >
            {spyX != null && (
              <span className="absolute font-mono whitespace-nowrap" style={{ top: stagger ? 0 : 2, left: `${spyX}%`, transform: "translateX(-50%)", fontSize: 9, color: AMBER }}>
                EE.UU. {fmt(spyV)}
              </span>
            )}
            {vtX != null && (
              <span className="absolute font-mono whitespace-nowrap" style={{ top: stagger ? 9 : 2, left: `${vtX}%`, transform: "translateX(-50%)", fontSize: 9, color: "#cbd5e1" }}>
                Mundo {fmt(vtV)}
              </span>
            )}
          </div>

          {/* Ranking */}
          <div className="relative" style={{ background: "#000000" }}>
            {/* Vertical reference overlay spanning all rows */}
            <div className="absolute inset-y-0 pointer-events-none" style={{ left: W_RANK + W_NAME + W_TKR, right: W_VAL }}>
              <div className="absolute inset-y-0" style={{ left: "50%", borderLeft: "1px solid rgba(255,255,255,.12)" }} />
              {vtX != null && <div className="absolute inset-y-0" style={{ left: `${vtX}%`, borderLeft: "1px dashed rgba(255,255,255,.55)" }} />}
              {spyX != null && <div className="absolute inset-y-0" style={{ left: `${spyX}%`, borderLeft: `1px dashed ${AMBER}` }} />}
            </div>

            {ranked.map((r, i) => {
              const v = valOf(r, period);
              const c = tone(v);
              const w = v != null ? (Math.abs(v) / maxAbs) * 50 : 0;
              return (
                <div key={r.ticker} className="cr-row flex items-center transition-colors" style={{ height: 24 }}>
                  <div className="font-mono text-right pr-1.5 text-text-sec" style={{ width: W_RANK, fontSize: 10 }}>{i + 1}</div>
                  <div className="cr-name text-white whitespace-nowrap overflow-hidden text-ellipsis" style={{ width: W_NAME, fontSize: 12 }}>{r.name}</div>
                  <div className="cr-tkr font-mono text-text-sec" style={{ width: W_TKR, fontSize: 10 }}>{r.ticker}</div>
                  <div className="relative" style={{ flex: 1, height: 24 }}>
                    {v != null && (
                      <div
                        className="absolute"
                        style={
                          v >= 0
                            ? { left: "50%", top: "50%", transform: "translateY(-50%)", height: 10, width: `${w}%`, background: c, borderRadius: "0 2px 2px 0" }
                            : { right: "50%", top: "50%", transform: "translateY(-50%)", height: 10, width: `${w}%`, background: c, borderRadius: "2px 0 0 2px" }
                        }
                      />
                    )}
                  </div>
                  <div className="text-right font-mono font-semibold" style={{ width: W_VAL, fontSize: 12, color: c }}>{fmt(v)}</div>
                </div>
              );
            })}
          </div>

          <div className="text-[10px] text-text-dim mt-3 leading-relaxed">
            Retorno total en USD, precio ajustado por dividendos. Datos al {fmtDate(data.lastDataDate)}. ETFs como proxy del mercado de cada país.
          </div>
        </>
      )}
    </div>
  );
}
