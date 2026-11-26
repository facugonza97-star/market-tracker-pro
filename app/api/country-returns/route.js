import { NextResponse } from "next/server";
import { COUNTRY_ETFS } from "@/lib/countryEtfs";

export const dynamic = "force-dynamic";

const API_KEY = process.env.FMP_API_KEY;
const STABLE = "https://financialmodelingprep.com/stable";

let cache = { data: null, timestamp: 0 };
const CACHE_TTL = 12 * 3600 * 1000; // 12h

function ymd(d) {
  return d.toISOString().split("T")[0];
}

// Dividend-adjusted (total return) daily closes → { date: adjClose } map.
async function fetchAdj(ticker, from, attempt = 0) {
  try {
    const res = await fetch(
      `${STABLE}/historical-price-eod/dividend-adjusted?symbol=${ticker}&from=${from}&apikey=${API_KEY}`,
      { next: { revalidate: 43200 } }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data) || !data.length) throw new Error("empty");
    const map = {};
    for (const r of data) if (r?.date && r.adjClose != null) map[r.date] = r.adjClose;
    return map;
  } catch (e) {
    if (attempt < 2) {
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      return fetchAdj(ticker, from, attempt + 1);
    }
    return null;
  }
}

// Run tasks with limited concurrency.
async function pool(items, limit, worker) {
  const out = new Array(items.length);
  let i = 0;
  async function run() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await worker(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return out;
}

function lastOnOrBefore(sortedDates, map, targetYmd) {
  // sortedDates ascending; return close of latest date <= target
  let lo = 0, hi = sortedDates.length - 1, idx = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (sortedDates[mid] <= targetYmd) { idx = mid; lo = mid + 1; } else { hi = mid - 1; }
  }
  return idx >= 0 ? map[sortedDates[idx]] : null;
}

function computeReturns(map, calYears) {
  const dates = Object.keys(map).sort();
  if (!dates.length) return null;
  const lastDate = dates[dates.length - 1];
  const cur = map[lastDate];
  const now = new Date(lastDate + "T00:00:00Z");

  const back = (days) => {
    const t = new Date(now.getTime() - days * 86400000);
    return lastOnOrBefore(dates, map, ymd(t));
  };
  const pct = (old) => (old != null && old > 0 ? +(((cur / old) - 1) * 100).toFixed(1) : null);

  const curYear = now.getUTCFullYear();
  const ytdBase = lastOnOrBefore(dates, map, `${curYear - 1}-12-31`);

  const cal = {};
  for (const y of calYears) {
    const end = lastOnOrBefore(dates, map, `${y}-12-31`);
    const start = lastOnOrBefore(dates, map, `${y - 1}-12-31`);
    cal[y] = end != null && start != null && start > 0 ? +(((end / start) - 1) * 100).toFixed(1) : null;
  }

  return {
    lastDate,
    returns: {
      m1: pct(back(30)),
      m3: pct(back(91)),
      m6: pct(back(182)),
      ytd: pct(ytdBase),
      y1: pct(back(365)),
      y3: pct(back(365 * 3)),
      cal,
    },
  };
}

export async function GET() {
  const now = Date.now();
  if (cache.data && now - cache.timestamp < CACHE_TTL) {
    return NextResponse.json(cache.data);
  }

  try {
    const from = ymd(new Date(Date.now() - Math.round(4.5 * 365) * 86400000)); // ~4.5 years
    const maps = await pool(COUNTRY_ETFS, 6, (etf) => fetchAdj(etf.ticker, from));

    // Determine calendar years from the freshest data available.
    let latestYear = new Date().getUTCFullYear();
    for (const m of maps) {
      if (m) {
        const dts = Object.keys(m);
        const y = Number(dts[dts.length - 1]?.slice(0, 4));
        if (y && y > latestYear) latestYear = y;
      }
    }
    const calYears = [latestYear - 1, latestYear - 2, latestYear - 3];

    let lastDataDate = null;
    const rows = COUNTRY_ETFS.map((etf, idx) => {
      const map = maps[idx];
      const computed = map ? computeReturns(map, calYears) : null;
      if (computed && (!lastDataDate || computed.lastDate > lastDataDate)) lastDataDate = computed.lastDate;
      return {
        ticker: etf.ticker,
        name: etf.name,
        region: etf.region,
        latam: !!etf.latam,
        aggregate: !!etf.aggregate,
        returns: computed ? computed.returns : { m1: null, m3: null, m6: null, ytd: null, y1: null, y3: null, cal: {} },
      };
    });

    const result = { rows, calYears, lastDataDate, updatedAt: new Date().toISOString() };
    cache = { data: result, timestamp: now };
    return NextResponse.json(result);
  } catch (error) {
    console.error("country-returns API error:", error.message);
    if (cache.data) return NextResponse.json(cache.data);
    return NextResponse.json({ rows: [], calYears: [], lastDataDate: null }, { status: 500 });
  }
}
