import { NextResponse } from "next/server";
import { fetchQuotes, fetchStockPriceChange } from "@/lib/fmp";
import yahooFinance from "yahoo-finance2";

export const dynamic = "force-dynamic";

async function fetchYahooQuote(ticker) {
  try {
    const result = await yahooFinance.quote(ticker);
    if (!result?.regularMarketPrice) return null;
    return {
      ticker,
      name: result.longName || result.shortName || ticker,
      price: result.regularMarketPrice,
      yearHigh: result.fiftyTwoWeekHigh ?? null,
      yearLow: result.fiftyTwoWeekLow ?? null,
      change: result.regularMarketChange ?? null,
      changesPercentage: result.regularMarketChangePercent ?? null,
      d1: result.regularMarketChangePercent ?? null,
      w1: null,
      m1: null,
      ytd: null,
      y1: null,
      y3: null,
      y5: null,
    };
  } catch {
    return null;
  }
}

export async function GET(req) {
  const raw = req.nextUrl.searchParams.get("symbols") || "";
  const tickers = [...new Set(raw.split(",").map((t) => t.trim()).filter(Boolean))];
  if (!tickers.length) return NextResponse.json({ rows: [] });

  try {
    const [quotes, priceChanges] = await Promise.all([
      fetchQuotes(tickers),
      fetchStockPriceChange(tickers),
    ]);

    const quoteMap = {};
    for (const q of (quotes ?? [])) {
      if (q?.symbol) quoteMap[q.symbol] = q;
    }

    const changeMap = {};
    for (const pc of (priceChanges ?? [])) {
      if (pc?.symbol) changeMap[pc.symbol] = pc;
    }

    // Identify tickers with no price from FMP — fall back to Yahoo Finance
    const missingTickers = tickers.filter((t) => !quoteMap[t]?.price);

    const yahooResults = await Promise.all(
      missingTickers.map((t) => fetchYahooQuote(t))
    );

    const yahooMap = {};
    for (let i = 0; i < missingTickers.length; i++) {
      if (yahooResults[i]) yahooMap[missingTickers[i]] = yahooResults[i];
    }

    const rows = tickers
      .map((ticker) => {
        // Yahoo Finance fallback
        if (yahooMap[ticker]) return yahooMap[ticker];

        const q = quoteMap[ticker];
        const pc = changeMap[ticker] || {};
        if (!q) return null;
        return {
          name: q.name ?? ticker,
          ticker,
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
      })
      .filter(Boolean);

    return NextResponse.json({ rows, updatedAt: new Date().toISOString() });
  } catch (e) {
    console.error("ticker-quotes error:", e);
    return NextResponse.json({ error: "Failed to fetch quotes" }, { status: 500 });
  }
}
