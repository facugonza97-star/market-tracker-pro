import { NextResponse } from "next/server";
import { fetchQuotes, fetchStockPriceChange } from "@/lib/fmp";
import { TICKER_CONFIG, SUMMARY_TICKERS } from "@/lib/config";


export const dynamic = "force-dynamic";

// Cache in memory
let cache = { data: null, timestamp: 0 };
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function GET() {
  const now = Date.now();

  // Return cached data if fresh
  if (cache.data && now - cache.timestamp < CACHE_TTL) {
    return NextResponse.json(cache.data);
  }

  try {
    // Collect all tickers
    const allTickers = [];
    for (const section of Object.values(TICKER_CONFIG)) {
      for (const item of section) {
        if (!allTickers.includes(item.ticker)) allTickers.push(item.ticker);
      }
    }
    for (const t of SUMMARY_TICKERS) {
      if (!allTickers.includes(t)) allTickers.push(t);
    }

    // Fetch quotes and price changes in parallel
    const [quotes, priceChanges] = await Promise.all([
      fetchQuotes(allTickers),
      fetchStockPriceChange(allTickers),
    ]);

    // Build lookup maps
    const quoteMap = {};
    for (const q of (quotes ?? [])) {
      if (q?.symbol) quoteMap[q.symbol] = q;
    }

    const changeMap = {};
    for (const pc of (priceChanges ?? [])) {
      if (pc?.symbol) changeMap[pc.symbol] = pc;
    }

    // Build response organized by section
    const sections = {};
    for (const [sectionName, items] of Object.entries(TICKER_CONFIG)) {
      sections[sectionName] = items.map((item) => {
        const q = quoteMap[item.ticker] || {};
        const pc = changeMap[item.ticker] || {};
        return {
          name: item.name,
          ticker: item.ticker,
          price: q.price ?? null,
          yearHigh: q.yearHigh ?? null,
          yearLow: q.yearLow ?? null,
          change: q.change ?? null,
          changesPercentage: q.changesPercentage ?? null,
          d1: pc["1D"] ?? q.changesPercentage ?? null,
          w1: pc["5D"] ?? null,
          m1: pc["1M"] ?? null,
          ytd: pc["ytd"] ?? null,
          y1: pc["1Y"] ?? null,
          y3: pc["3Y"] ?? null,
          y5: pc["5Y"] ?? null,
        };
      });
    }

    // Build summary quotes for tickers not in sections
    const summaryQuotes = {};
    for (const t of SUMMARY_TICKERS) {
      const q = quoteMap[t] || {};
      const pc = changeMap[t] || {};
      summaryQuotes[t] = {
        price: q.price ?? null,
        yearHigh: q.yearHigh ?? null,
        d1: pc["1D"] ?? q.changesPercentage ?? null,
      };
    }

    const result = {
      sections,
      summaryQuotes,
      updatedAt: new Date().toISOString(),
    };

    cache = { data: result, timestamp: now };
    return NextResponse.json(result);
  } catch (error) {
    console.error("Quotes API error:", error);
    // Return stale cache if available
    if (cache.data) return NextResponse.json(cache.data);
    return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 });
  }
}
