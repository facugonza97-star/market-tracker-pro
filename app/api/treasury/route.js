import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const API_KEY = process.env.FMP_API_KEY;
const STABLE = "https://financialmodelingprep.com/stable";

let cache = { data: null, timestamp: 0 };
const CACHE_TTL = 30 * 60 * 1000; // 30 min

// Year-ago curve barely changes — cache it separately and much longer.
let yearAgoCache = { data: null, timestamp: 0 };
const YEAR_AGO_TTL = 24 * 3600 * 1000; // 24h

function ymd(d) {
  return d.toISOString().split("T")[0];
}

// Fetch the Treasury curve for the nearest business day on-or-before ~1 year ago.
async function fetchYearAgoCurve() {
  const now = Date.now();
  if (yearAgoCache.data && now - yearAgoCache.timestamp < YEAR_AGO_TTL) {
    return yearAgoCache.data;
  }
  try {
    const target = new Date(Date.now() - 365 * 86400000);
    const from = ymd(new Date(target.getTime() - 10 * 86400000)); // 10-day cushion for holidays/weekends
    const to = ymd(target);
    const res = await fetch(
      `${STABLE}/treasury-rates?from=${from}&to=${to}&apikey=${API_KEY}`,
      { next: { revalidate: YEAR_AGO_TTL / 1000 } }
    );
    if (!res.ok) return yearAgoCache.data ?? null;
    const data = await res.json();
    // Newest first — data[0] is the closest business day on-or-before the target.
    const curve = Array.isArray(data) && data.length > 0 ? data[0] : null;
    if (curve) yearAgoCache = { data: curve, timestamp: now };
    return curve;
  } catch {
    return yearAgoCache.data ?? null;
  }
}

export async function GET() {
  const now = Date.now();
  if (cache.data && now - cache.timestamp < CACHE_TTL) {
    return NextResponse.json(cache.data);
  }
  try {
    const [res, yearAgo] = await Promise.all([
      fetch(`${STABLE}/treasury-rates?apikey=${API_KEY}`, { next: { revalidate: 3600 } }),
      fetchYearAgoCurve(),
    ]);
    if (!res.ok) throw new Error("Treasury fetch failed");
    const data = await res.json();
    const latest = Array.isArray(data) ? data[0] : data;
    const prev = Array.isArray(data) && data.length > 1 ? data[1] : null;
    const result = { ...latest };
    if (prev) result._prev = prev;
    if (yearAgo) result._yearAgo = yearAgo;
    cache = { data: result, timestamp: now };
    return NextResponse.json(result);
  } catch (error) {
    console.error("Treasury API error:", error);
    if (cache.data) return NextResponse.json(cache.data);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
