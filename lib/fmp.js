const API_KEY = process.env.FMP_API_KEY;
const BASE = "https://financialmodelingprep.com/api/v3";
const STABLE = "https://financialmodelingprep.com/stable";

export async function fetchQuotes(tickers) {
  if (!tickers.length) return [];
  // FMP allows batch quotes with comma-separated tickers
  const chunks = [];
  for (let i = 0; i < tickers.length; i += 50) {
    chunks.push(tickers.slice(i, i + 50));
  }
  const results = [];
  for (const chunk of chunks) {
    const symbols = chunk.join(",");
    const res = await fetch(`${BASE}/quote/${symbols}?apikey=${API_KEY}`, { next: { revalidate: 300 } });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) results.push(...data);
    }
  }
  return results;
}

export async function fetchForexQuotes() {
  const res = await fetch(`${BASE}/quotes/forex?apikey=${API_KEY}`, { next: { revalidate: 300 } });
  if (!res.ok) return [];
  return res.json();
}

export async function fetchTreasuryRates() {
  const res = await fetch(`${BASE}/treasury?apikey=${API_KEY}`, { next: { revalidate: 3600 } });
  if (!res.ok) return [];
  return res.json();
}

export async function fetchStockNews(limit = 10) {
  const res = await fetch(`${BASE}/stock_news?limit=${limit}&apikey=${API_KEY}`, { next: { revalidate: 600 } });
  if (!res.ok) return [];
  return res.json();
}

export async function fetchStockPriceChange(tickers) {
  if (!tickers.length) return [];
  const symbols = tickers.join(",");
  const res = await fetch(`${BASE}/stock-price-change/${symbols}?apikey=${API_KEY}`, { next: { revalidate: 300 } });
  if (!res.ok) return [];
  return res.json();
}

export async function fetchForexPriceChange(pair) {
  const res = await fetch(`${BASE}/stock-price-change/${pair}?apikey=${API_KEY}`, { next: { revalidate: 300 } });
  if (!res.ok) return [];
  return res.json();
}
