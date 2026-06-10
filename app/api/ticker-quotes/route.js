import { NextResponse } from "next/server";
import { fetchQuotes, fetchStockPriceChange } from "@/lib/fmp";

export const dynamic = "force-dynamic";

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
    for (const q of quotes) quoteMap[q.symbol] = q;

    const changeMap = {};
    for (const pc of priceChanges) changeMap[pc.symbol] = pc;

    // Preserve the requested order; drop tickers that returned no quote at all
    const rows = tickers
      .map((ticker) => {
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
          changesPercentage: q.changePercentage ?? null,
          d1: pc["1D"] ?? q.changePercentage ?? null,
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
