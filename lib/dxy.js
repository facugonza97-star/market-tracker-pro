import YahooFinance from "yahoo-finance2";

// yahoo-finance2 v3 must be instantiated (v2's pre-built singleton is gone).
const yahoo = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

// DXY (US Dollar Index) isn't available on FMP's Starter plan, so we pull the
// real ICE index from Yahoo Finance (symbol DX-Y.NYB). This module owns a single
// shared cache so every consumer (quotes + forex routes) triggers at most one
// Yahoo call per TTL window instead of one each.
let cache = { data: null, timestamp: 0 };
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes — matches the other Overview APIs

export async function getDxy() {
  const now = Date.now();
  if (cache.data && now - cache.timestamp < CACHE_TTL) return cache.data;

  try {
    const r = await yahoo.quote("DX-Y.NYB");
    if (!r?.regularMarketPrice) throw new Error("no price");
    const data = {
      price: r.regularMarketPrice,
      yearHigh: r.fiftyTwoWeekHigh ?? null,
      yearLow: r.fiftyTwoWeekLow ?? null,
      d1: r.regularMarketChangePercent ?? null,
    };
    cache = { data, timestamp: now };
    return data;
  } catch {
    // Fall back to the last good value if Yahoo fails; null if we never had one.
    return cache.data ?? null;
  }
}
