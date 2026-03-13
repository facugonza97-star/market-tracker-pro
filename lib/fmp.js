const API_KEY = process.env.FMP_API_KEY;
const STABLE = "https://financialmodelingprep.com/stable";

async function fetchSingleQuote(symbol) {
  const res = await fetch(`${STABLE}/quote?symbol=${symbol}&apikey=${API_KEY}`, { next: { revalidate: 300 } });
  if (!res.ok) return null;
  const data = await res.json();
  return Array.isArray(data) && data.length > 0 ? data[0] : null;
}

export async function fetchQuotes(tickers) {
  if (!tickers.length) return [];
  const promises = tickers.map(fetchSingleQuote);
  const results = await Promise.all(promises);
  return results.filter(Boolean);
}

export async function fetchForexQuotes(tickers) {
  if (!tickers.length) return [];
  return fetchQuotes(tickers);
}

export async function fetchStockNews(limit = 10) {
  const res = await fetch(`${STABLE}/news/stock?limit=${limit}&apikey=${API_KEY}`, { next: { revalidate: 600 } });
  if (!res.ok) return [];
  return res.json();
}

// Calculate price changes from historical EOD data for index tickers
async function fetchIndexPriceChange(symbol) {
  // Request 5+ years of data so we can calculate 5Y returns
  const from = new Date();
  from.setDate(from.getDate() - 5 * 365 - 30); // extra 30d buffer
  const fromStr = from.toISOString().split("T")[0];
  const res = await fetch(
    `${STABLE}/historical-price-eod/full?symbol=${encodeURIComponent(symbol)}&from=${fromStr}&apikey=${API_KEY}`,
    { next: { revalidate: 300 } }
  );
  if (!res.ok) return null;
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) return null;

  // data is sorted newest first
  const latest = data[0];
  const now = new Date(latest.date);
  const currentPrice = latest.close;

  function findClosestPrice(daysAgo) {
    const target = new Date(now);
    target.setDate(target.getDate() - daysAgo);
    // Find the closest entry on or before the target date
    for (const entry of data) {
      if (new Date(entry.date) <= target) return entry.close;
    }
    return null;
  }

  function findYTDPrice() {
    const yearStart = `${now.getFullYear()}-01-01`;
    for (const entry of data) {
      if (entry.date <= yearStart) return entry.close;
    }
    return null;
  }

  function pctChange(oldPrice) {
    if (!oldPrice) return null;
    return ((currentPrice - oldPrice) / oldPrice) * 100;
  }

  return {
    symbol,
    "1D": latest.changePercent || null,
    "5D": pctChange(findClosestPrice(5)),
    "1M": pctChange(findClosestPrice(30)),
    "ytd": pctChange(findYTDPrice()),
    "1Y": pctChange(findClosestPrice(365)),
    "3Y": pctChange(findClosestPrice(365 * 3)),
    "5Y": pctChange(findClosestPrice(365 * 5)),
  };
}

export async function fetchStockPriceChange(tickers) {
  if (!tickers.length) return [];

  const indexTickers = tickers.filter(t => t.startsWith("^"));
  const normalTickers = tickers.filter(t => !t.startsWith("^"));

  // Fetch index and normal tickers in parallel
  const indexPromise = Promise.all(indexTickers.map(fetchIndexPriceChange));

  let normalResults = [];
  if (normalTickers.length > 0) {
    for (let i = 0; i < normalTickers.length; i += 50) {
      const symbols = normalTickers.slice(i, i + 50).join(",");
      const res = await fetch(`${STABLE}/stock-price-change?symbol=${symbols}&apikey=${API_KEY}`, { next: { revalidate: 300 } });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) normalResults.push(...data);
      }
    }
  }

  const indexResults = (await indexPromise).filter(Boolean);
  return [...normalResults, ...indexResults];
}
