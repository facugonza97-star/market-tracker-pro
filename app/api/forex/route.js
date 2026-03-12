import { NextResponse } from "next/server";
import { fetchForexQuotes } from "@/lib/fmp";
import { FOREX_CONFIG } from "@/lib/config";

export const dynamic = "force-dynamic";

let cache = { data: null, timestamp: 0 };
const CACHE_TTL = 5 * 60 * 1000;

export async function GET() {
  const now = Date.now();
  if (cache.data && now - cache.timestamp < CACHE_TTL) {
    return NextResponse.json(cache.data);
  }
  try {
    const tickers = FOREX_CONFIG.map(f => f.ticker);
    const data = await fetchForexQuotes(tickers);

    const result = FOREX_CONFIG.map(fc => {
      const q = data.find(d => d.symbol === fc.ticker) || {};
      return {
        ...fc,
        price: q.price || null,
        change: q.changePercentage || null,
        dayHigh: q.dayHigh || null,
        dayLow: q.dayLow || null,
        yearHigh: q.yearHigh || null,
        yearLow: q.yearLow || null,
      };
    });

    cache = { data: result, timestamp: now };
    return NextResponse.json(result);
  } catch (error) {
    if (cache.data) return NextResponse.json(cache.data);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
