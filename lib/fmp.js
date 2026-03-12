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

export async function fetchStockPriceChange(tickers) {
  if (!tickers.length) return [];
  // Filter out index tickers (^GSPC, ^IXIC, etc.) — not supported by this endpoint
  const valid = tickers.filter(t => !t.startsWith("^"));
  if (!valid.length) return [];
  // Batch in groups of 50 to avoid URL length issues
  const results = [];
  for (let i = 0; i < valid.length; i += 50) {
    const symbols = valid.slice(i, i + 50).join(",");
    const res = await fetch(`${STABLE}/stock-price-change?symbol=${symbols}&apikey=${API_KEY}`, { next: { revalidate: 300 } });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) results.push(...data);
    }
  }
  return results;
}
