import { NextResponse } from "next/server";
import { fetchForexQuotes, fetchStockPriceChange } from "@/lib/fmp";
import { FOREX_CONFIG } from "@/lib/config";
import { getDxy } from "@/lib/dxy";

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

    // DXY (real ICE Dollar Index) via the shared Yahoo module. Yahoo only gives
    // us spot + daily change, so the longer periods stay null → render as "—".
    const dxy = await getDxy();
    const dxyRow = {
      name: "US Dollar Index",
      ticker: "DXY",
      flag: "🇺🇸",
      price: dxy?.price ?? null,
      change: dxy?.d1 ?? null,
      yearHigh: dxy?.yearHigh ?? null,
      d1: dxy?.d1 ?? null,
      w1: null,
      m1: null,
      ytd: null,
      y1: null,
      y3: null,
    };

    const withDxy = [dxyRow, ...result];
    cache = { data: withDxy, timestamp: now };
    return NextResponse.json(withDxy);
  } catch (error) {
    if (cache.data) return NextResponse.json(cache.data);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
