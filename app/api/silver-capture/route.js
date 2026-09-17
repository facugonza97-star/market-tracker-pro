import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const API_KEY = process.env.FMP_API_KEY;
const STABLE = "https://financialmodelingprep.com/stable";

// The computed table barely changes intraday — cache the result, not raw prices.
let cache = { data: null, timestamp: 0 };
const CACHE_TTL = 24 * 3600 * 1000; // 24h

async function fetchHistory(symbol) {
  const res = await fetch(
    `${STABLE}/historical-price-eod/full?symbol=${symbol}&from=2005-01-01&apikey=${API_KEY}`,
    { next: { revalidate: 86400 } }
  );
  if (!res.ok) return null;
  const data = await res.json();
  if (!Array.isArray(data)) return null;
  const map = {};
  for (const r of data) if (r?.date && r.close != null) map[r.date] = r.close;
  return map;
}

// ISO week number for "YYYY-MM-DD".
function isoWeekKey(dt) {
  const [y, m, d] = dt.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function periodKey(dt, freq) {
  const [y, m] = dt.split("-");
  if (freq === "W") return isoWeekKey(dt);
  if (freq === "M") return `${y}-${m}`;
  if (freq === "Q") return `${y}-Q${Math.floor((Number(m) - 1) / 3)}`;
  if (freq === "A") return y;
  return dt;
}

// Last close of each period, in chronological order → [ [gold, silver], ... ].
function resampleLastClose(dates, gc, si, freq) {
  const last = new Map();
  for (const dt of dates) last.set(periodKey(dt, freq), [gc[dt], si[dt]]);
  return [...last.values()];
}

function returns(series) {
  const out = [];
  for (let i = 1; i < series.length; i++) {
    const [g0, s0] = series[i - 1], [g1, s1] = series[i];
    out.push([g1 / g0 - 1, s1 / s0 - 1]);
  }
  return out;
}

// Upside/downside capture: silver vs gold as benchmark, classified by gold's sign.
function capture(rets) {
  const up = rets.filter(([g]) => g > 0);
  const dn = rets.filter(([g]) => g < 0);
  if (!up.length || !dn.length) return null;
  const mean = (arr, idx) => arr.reduce((s, r) => s + r[idx], 0) / arr.length;
  const uc = (mean(up, 1) / mean(up, 0)) * 100;
  const dc = (mean(dn, 1) / mean(dn, 0)) * 100;
  return { uc, dc, ratio: uc / dc, nUp: up.length, nDown: dn.length };
}

export async function GET() {
  const now = Date.now();
  if (cache.data && now - cache.timestamp < CACHE_TTL) {
    return NextResponse.json(cache.data);
  }

  try {
    const [gc, si] = await Promise.all([fetchHistory("GCUSD"), fetchHistory("SIUSD")]);
    if (!gc || !si) throw new Error("history unavailable");

    const dates = Object.keys(gc).filter((d) => si[d] != null).sort();
    if (dates.length < 250) throw new Error("insufficient history");

    const dailyRets = returns(dates.map((d) => [gc[d], si[d]]));

    const freqs = [
      { key: "D", label: "Diario" },
      { key: "W", label: "Semanal" },
      { key: "M", label: "Mensual" },
      { key: "Q", label: "Trimestral" },
      { key: "A", label: "Anual" },
    ];

    const periods = [], upside = [], downside = [], ratio = [], nUp = [], nDown = [];
    for (const f of freqs) {
      const rets = f.key === "D" ? dailyRets : returns(resampleLastClose(dates, gc, si, f.key));
      const c = capture(rets);
      periods.push(f.label);
      upside.push(c ? +c.uc.toFixed(1) : null);
      downside.push(c ? +c.dc.toFixed(1) : null);
      ratio.push(c ? +c.ratio.toFixed(2) : null);
      nUp.push(c ? c.nUp : null);
      nDown.push(c ? c.nDown : null);
    }

    const from = dates[0], to = dates[dates.length - 1];
    const years = +(
      (new Date(to) - new Date(from)) / (365.25 * 86400000)
    ).toFixed(1);

    const result = { periods, upside, downside, ratio, nUp, nDown, from, to, years, updatedAt: new Date().toISOString() };
    cache = { data: result, timestamp: now };
    return NextResponse.json(result);
  } catch (error) {
    console.error("silver-capture API error:", error.message);
    if (cache.data) return NextResponse.json(cache.data);
    return NextResponse.json({ error: "Failed", periods: [] }, { status: 500 });
  }
}
