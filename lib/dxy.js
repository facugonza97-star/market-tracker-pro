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

// Historical period changes (1W/1M/YTD/1Y/3Y) + 52-week high, computed from
// Yahoo daily EOD data using the same logic as fmp.js `fetchIndexPriceChange`
// so the DXY row is consistent with the index tickers elsewhere. These barely
// move intraday, so they get a longer TTL than the spot price.
let histCache = { data: null, timestamp: 0 };
const HIST_TTL = 60 * 60 * 1000; // 1 hour

export async function getDxyHistory() {
  const now = Date.now();
  if (histCache.data && now - histCache.timestamp < HIST_TTL) return histCache.data;

  try {
    // 3Y + buffer of daily bars so the 3Y lookback always has data.
    const period1 = new Date();
    period1.setFullYear(period1.getFullYear() - 3);
    period1.setDate(period1.getDate() - 30);

    const res = await yahoo.chart("DX-Y.NYB", { period1, interval: "1d" });
    const bars = (res?.quotes ?? []).filter((b) => b.close != null);
    if (!bars.length) throw new Error("no history");

    // Sort newest-first, matching fetchIndexPriceChange's expectations.
    const rows = bars
      .map((b) => ({ date: new Date(b.date), close: b.close }))
      .sort((a, b) => b.date - a.date);

    const nowDate = rows[0].date;
    const current = rows[0].close;

    const closest = (daysAgo) => {
      const target = new Date(nowDate);
      target.setDate(target.getDate() - daysAgo);
      for (const r of rows) {
        if (r.date <= target) return r.close;
      }
      return null;
    };

    const ytdBase = () => {
      const yearStart = `${nowDate.getFullYear()}-01-01`;
      for (const r of rows) {
        if (r.date.toISOString().slice(0, 10) <= yearStart) return r.close;
      }
      return null;
    };

    const pct = (old) => (old ? ((current - old) / old) * 100 : null);

    // 52-week high from the last 365 days of closes.
    const cutoff = new Date(nowDate);
    cutoff.setDate(cutoff.getDate() - 365);
    const last52 = rows.filter((r) => r.date >= cutoff);
    const yearHigh = last52.length ? Math.max(...last52.map((r) => r.close)) : null;

    const data = {
      yearHigh,
      w1: pct(closest(7)),
      m1: pct(closest(30)),
      ytd: pct(ytdBase()),
      y1: pct(closest(365)),
      y3: pct(closest(365 * 3)),
    };
    histCache = { data, timestamp: now };
    return data;
  } catch {
    return histCache.data ?? null;
  }
}
