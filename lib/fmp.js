const API_KEY = process.env.FMP_API_KEY;
const STABLE = "https://financialmodelingprep.com/stable";

export async function fetchQuotes(tickers) {
  if (!tickers.length) return [];
  const chunks = [];
  for (let i = 0; i < tickers.length; i += 50) {
    chunks.push(tickers.slice(i, i + 50));
  }
  const results = [];
  for (const chunk of chunks) {
    const symbols = chunk.join(",");
    const res = await fetch(`${STABLE}/quote?symbol=${symbols}&apikey=${API_KEY}`, { next: { revalidate: 300 } });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) results.push(...data);
    }
  }
  return results;
}

export async function fetchForexQuotes(tickers) {
  if (!tickers.length) return [];
  const symbols = tickers.join(",");
  const res = await fetch(`${STABLE}/quote?symbol=${symbols}&apikey=${API_KEY}`, { next: { revalidate: 300 } });
  if (!res.ok) return [];
  return res.json();
}

export async function fetchStockNews(limit = 10) {
  const res = await fetch(`${STABLE}/news/stock?limit=${limit}&apikey=${API_KEY}`, { next: { revalidate: 600 } });
  if (!res.ok) return [];
  return res.json();
}

export async function fetchStockPriceChange(tickers) {
  if (!tickers.length) return [];
  const symbols = tickers.join(",");
  const res = await fetch(`${STABLE}/stock-price-change?symbol=${symbols}&apikey=${API_KEY}`, { next: { revalidate: 300 } });
  if (!res.ok) return [];
  return res.json();
}
