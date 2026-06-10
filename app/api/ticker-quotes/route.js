import { NextResponse } from "next/server";
import { fetchQuotes, fetchStockPriceChange } from "@/lib/fmp";

export const dynamic = "force-dynamic";

const TWELVE_DATA_API_KEY = process.env.TWELVE_DATA_API_KEY;

async function fetchTwelveDataQuote(ticker) {
  try {
    const res = await fetch(
      `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(ticker)}&apikey=${TWELVE_DATA_API_KEY}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status === "error" || !data.close) return null;
    return {
      name: data.name ?? ticker,
      ticker,
      price: parseFloat(data.close) || null,
      yearHigh: parseFloat(data.fifty_two_week?.high) || null,
      yearLow: parseFloat(data.fifty_two_week?.low) || null,
      change: parseFloat(data.change) || null,
      changesPercentage: parseFloat(data.percent_change) || null,
      d1: parseFloat(data.percent_change) || null,
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

    // Identify tickers with no price from FMP — fall back to Twelve Data
    const missingTickers = tickers.filter((t) => !quoteMap[t]?.price);

    const twelveDataResults = await Promise.all(
      missingTickers.map((t) => fetchTwelveDataQuote(t))
    );

    const twelveDataMap = {};
    for (let i = 0; i < missingTickers.length; i++) {
      if (twelveDataResults[i]) twelveDataMap[missingTickers[i]] = twelveDataResults[i];
    }

    const rows = tickers
      .map((ticker) => {
        // Twelve Data fallback
        if (twelveDataMap[ticker]) return twelveDataMap[ticker];

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
