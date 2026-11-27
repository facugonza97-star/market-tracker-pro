import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const FRED_CSV = "https://fred.stlouisfed.org/graph/fredgraph.csv";

// ICE BofA OAS series (FRED free CSV caps these at a rolling ~3 years by ICE license).
const ICE = [
  { id: "usig", name: "US Investment Grade", series: "BAMLC0A0CM" },
  { id: "ushy", name: "US High Yield", series: "BAMLH0A0HYM2" },
  { id: "emcorp", name: "EM Corporate", series: "BAMLEMCBPIOAS" },
  { id: "eurohy", name: "Euro High Yield", series: "BAMLHE00EHYIOAS" },
];

let cache = { data: null, timestamp: 0 };
const CACHE_TTL = 12 * 3600 * 1000; // 12h

async function fredSeries(id) {
  const res = await fetch(`${FRED_CSV}?id=${id}`, { next: { revalidate: 43200 } });
  if (!res.ok) return null;
  const text = await res.text();
  const lines = text.trim().split("\n").slice(1); // drop header
  const out = [];
  for (const line of lines) {
    const [date, raw] = line.split(",");
    const v = parseFloat(raw);
    if (date && !isNaN(v)) out.push({ date, value: v });
  }
  return out;
}

// ISO-week key so we can keep one observation per week.
function isoWeek(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const day = dt.getUTCDay() || 7;
  dt.setUTCDate(dt.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((dt - yearStart) / 86400000 + 1) / 7);
  return `${dt.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

// Keep the last observation of each ISO week, chronological. `fn` maps a row to bps.
function weekly(rows, fn) {
  const byWeek = new Map();
  for (const r of rows) byWeek.set(isoWeek(r.date), { date: r.date, bps: fn(r) });
  return [...byWeek.values()].filter((p) => p.bps != null).sort((a, b) => (a.date < b.date ? -1 : 1));
}

export async function GET() {
  const now = Date.now();
  if (cache.data && now - cache.timestamp < CACHE_TTL) {
    return NextResponse.json(cache.data);
  }

  try {
    const iceRaw = await Promise.all(ICE.map((c) => fredSeries(c.series)));
    const [mortRaw, dgsRaw] = await Promise.all([fredSeries("MORTGAGE30US"), fredSeries("DGS10")]);
    if (iceRaw.some((s) => !s) || !mortRaw || !dgsRaw) throw new Error("FRED series unavailable");

    // Shared window = earliest date among the (3-year-capped) ICE series, for comparability.
    const iceStart = iceRaw.reduce((min, s) => {
      const d = s[0]?.date;
      return d && (!min || d < min) ? d : min;
    }, null);

    // ICE: daily (bps). Client uses daily for 1M/3M/6M and downsamples to weekly for 1A/3A.
    const categories = ICE.map((c, i) => ({
      id: c.id,
      name: c.name,
      data: iceRaw[i]
        .map((r) => ({ date: r.date, bps: +(r.value * 100).toFixed(1) }))
        .filter((p) => p.bps != null)
        .sort((a, b) => (a.date < b.date ? -1 : 1)),
    }));

    // Mortgage proxy: MORTGAGE30US (weekly) − DGS10 (daily, nearest on/before), capped to the ICE window.
    const dgsByDate = new Map(dgsRaw.map((r) => [r.date, r.value]));
    const dgsDates = dgsRaw.map((r) => r.date); // ascending
    const nearestDgs = (date) => {
      if (dgsByDate.has(date)) return dgsByDate.get(date);
      // binary-ish walk back to the most recent prior trading day
      let lo = 0, hi = dgsDates.length - 1, idx = -1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (dgsDates[mid] <= date) { idx = mid; lo = mid + 1; } else { hi = mid - 1; }
      }
      return idx >= 0 ? dgsByDate.get(dgsDates[idx]) : null;
    };
    const mortData = weekly(
      mortRaw.filter((r) => !iceStart || r.date >= iceStart),
      (r) => {
        const d = nearestDgs(r.date);
        return d == null ? null : +((r.value - d) * 100).toFixed(1);
      }
    );
    categories.push({
      id: "mortgage",
      name: "US Mortgage Rate Spread",
      data: mortData,
    });

    const result = { categories, window: { from: iceStart }, updatedAt: new Date().toISOString() };
    cache = { data: result, timestamp: now };
    return NextResponse.json(result);
  } catch (error) {
    console.error("spreads-history API error:", error.message);
    if (cache.data) return NextResponse.json(cache.data);
    return NextResponse.json({ categories: [] }, { status: 500 });
  }
}
