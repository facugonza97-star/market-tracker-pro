import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const API_KEY = process.env.FMP_API_KEY;
const STABLE = "https://financialmodelingprep.com/stable";

let cache = { data: null, timestamp: 0 };
const CACHE_TTL = 900 * 1000;

export async function GET() {
  const now = Date.now();
  if (cache.data && now - cache.timestamp < CACHE_TTL) {
    return NextResponse.json(cache.data);
  }

  try {
    const [gRes, lRes] = await Promise.all([
      fetch(`${STABLE}/stock-market-gainers?apikey=${API_KEY}`),
      fetch(`${STABLE}/stock-market-losers?apikey=${API_KEY}`),
    ]);

    const [gainers, losers] = await Promise.all([
      gRes.ok ? gRes.json() : [],
      lRes.ok ? lRes.json() : [],
    ]);

    const pick = (arr) =>
      (Array.isArray(arr) ? arr : []).slice(0, 5).map((s) => ({
        name: s.name,
        symbol: s.symbol,
        price: s.price,
        change: s.changesPercentage ?? s.changePercentage,
      }));

    const result = { gainers: pick(gainers), losers: pick(losers) };
    cache = { data: result, timestamp: now };
    return NextResponse.json(result);
  } catch (error) {
    console.error("Movers error:", error.message);
    if (cache.data) return NextResponse.json(cache.data);
    return NextResponse.json({ gainers: [], losers: [] });
  }
}
