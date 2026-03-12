import { NextResponse } from "next/server";
import { fetchForexQuotes, fetchStockPriceChange } from "@/lib/fmp";
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
    const [data, priceChanges] = await Promise.all([
      fetchForexQuotes(tickers),
      fetchStockPriceChange(tickers),
    ]);

    const changeMap = {};
    for (const pc of priceChanges) {
      changeMap[pc.symbol] = pc;
    }

    const result = FOREX_CONFIG.map(fc => {
      const q = data.find(d => d.symbol === fc.ticker) || {};
      const pc = changeMap[fc.ticker] || {};
      return {
        ...fc,
        price: q.price ?? null,
        change: q.changePercentage ?? null,
        yearHigh: q.yearHigh ?? null,
        d1: pc["1D"] ?? q.changePercentage ?? null,
        w1: pc["5D"] ?? null,
        m1: pc["1M"] ?? null,
        ytd: pc["ytd"] ?? null,
        y1: pc["1Y"] ?? null,
        y3: pc["3Y"] ?? null,
      };
    });

    cache = { data: result, timestamp: now };
    return NextResponse.json(result);
  } catch (error) {
    if (cache.data) return NextResponse.json(cache.data);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
