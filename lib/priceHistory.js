// Shared server-side price history (total return when available) with an
// in-memory per-ticker cache. Used by the Laboratorio endpoint. Kept separate
// from /api/country-returns so that endpoint is untouched.
const API_KEY = process.env.FMP_API_KEY;
const STABLE = "https://financialmodelingprep.com/stable";
const CACHE_TTL = 12 * 3600 * 1000; // 12h
const PROFILE_TTL = 24 * 3600 * 1000; // 24h
const NEW_LIMIT = 30; // distinct new (off-universe) tickers per rolling hour

// ticker -> { rows: [[date, close]] ascending, adjusted: bool, timestamp }
const cache = new Map();
// ticker -> { name, timestamp }
const profileCache = new Map();
// rolling log of newly-fetched off-universe tickers: [{ ticker, time }]
const newLog = [];

async function fetchJson(url, attempt = 0) {
  try {
    const res = await fetch(url, { next: { revalidate: 43200 } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    if (attempt < 2) {
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      return fetchJson(url, attempt + 1);
    }
    return null;
  }
}

function toRows(data, field) {
  if (!Array.isArray(data) || !data.length) return null;
  const rows = [];
  for (const r of data) if (r?.date && r[field] != null) rows.push([r.date, r[field]]);
  if (!rows.length) return null;
  rows.sort((a, b) => (a[0] < b[0] ? -1 : 1));
  return rows;
}

// Fetches dividend-adjusted first; falls back to full (close) marked unadjusted.
async function fetchSeries(ticker, from) {
  const e = encodeURIComponent(ticker);
  const adj = await fetchJson(`${STABLE}/historical-price-eod/dividend-adjusted?symbol=${e}&from=${from}&apikey=${API_KEY}`);
  const adjRows = toRows(adj, "adjClose");
  if (adjRows) return { rows: adjRows, adjusted: true };

  const full = await fetchJson(`${STABLE}/historical-price-eod/full?symbol=${e}&from=${from}&apikey=${API_KEY}`);
  const fullRows = toRows(full, "close");
  if (fullRows) return { rows: fullRows, adjusted: false };

  return null;
}

export function hasFresh(ticker) {
  const hit = cache.get(ticker);
  return !!(hit && Date.now() - hit.timestamp < CACHE_TTL && hit.rows);
}

// Reserve rate-limit budget for off-universe tickers that need a fresh fetch.
// Returns true if allowed; false if it would exceed NEW_LIMIT this hour.
export function tryReserveNew(tickers) {
  const now = Date.now();
  const cutoff = now - 3600 * 1000;
  while (newLog.length && newLog[0].time < cutoff) newLog.shift();
  const distinct = new Set(newLog.map((x) => x.ticker));
  const toAdd = tickers.filter((t) => !distinct.has(t));
  if (distinct.size + toAdd.length > NEW_LIMIT) return false;
  for (const t of toAdd) newLog.push({ ticker: t, time: now });
  return true;
}

// Returns { rows, adjusted } since `from`, cached 12h with stale fallback, or null.
export async function getSeries(ticker, from) {
  const now = Date.now();
  const hit = cache.get(ticker);
  if (hit && now - hit.timestamp < CACHE_TTL && hit.rows) {
    return { rows: hit.rows, adjusted: hit.adjusted };
  }
  const fresh = await fetchSeries(ticker, from);
  if (fresh) {
    cache.set(ticker, { ...fresh, timestamp: now });
    return fresh;
  }
  return hit && hit.rows ? { rows: hit.rows, adjusted: hit.adjusted } : null;
}

// Company/ETF name from /profile, cached 24h. Falls back to the ticker.
export async function getProfileName(ticker) {
  const now = Date.now();
  const hit = profileCache.get(ticker);
  if (hit && now - hit.timestamp < PROFILE_TTL) return hit.name;
  const data = await fetchJson(`${STABLE}/profile?symbol=${encodeURIComponent(ticker)}&apikey=${API_KEY}`);
  const name = Array.isArray(data) && data[0]?.companyName ? data[0].companyName : ticker;
  profileCache.set(ticker, { name, timestamp: now });
  return name;
}

// Limited-concurrency map.
export async function pool(items, limit, worker) {
  const out = new Array(items.length);
  let i = 0;
  async function run() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await worker(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return out;
}
