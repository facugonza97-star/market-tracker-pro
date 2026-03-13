import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const API_KEY = process.env.FMP_API_KEY;
const STABLE = "https://financialmodelingprep.com/stable";

let cache = { data: null, timestamp: 0 };
const CACHE_TTL = 3600 * 1000;

export async function GET() {
  const now = Date.now();
  if (cache.data && now - cache.timestamp < CACHE_TTL) {
    return NextResponse.json(cache.data);
  }

  try {
    const today = new Date();
    const from = today.toISOString().split("T")[0];
    const to = new Date(today.getTime() + 14 * 86400000).toISOString().split("T")[0];

    const res = await fetch(
      `${STABLE}/economic-calendar?from=${from}&to=${to}&apikey=${API_KEY}`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) {
      console.error("Econ calendar fetch failed:", res.status);
      return NextResponse.json([]);
    }

    const data = await res.json();
    if (!Array.isArray(data)) return NextResponse.json([]);

    const filtered = data
      .filter((e) => e.country === "US" && e.impact === "High")
      .sort((a, b) => (a.date > b.date ? 1 : -1))
      .slice(0, 10)
      .map((e) => ({
        date: e.date,
        event: e.event,
        estimate: e.estimate,
        previous: e.previous,
        actual: e.actual,
        change: e.change,
      }));

    cache = { data: filtered, timestamp: now };
    return NextResponse.json(filtered);
  } catch (error) {
    console.error("Econ calendar error:", error.message);
    if (cache.data) return NextResponse.json(cache.data);
    return NextResponse.json([]);
  }
}
