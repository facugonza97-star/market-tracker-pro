// Shared server-side price history (total return, dividend-adjusted) with an
// in-memory per-ticker cache. Used by the Laboratorio endpoint. Kept separate
// from /api/country-returns so that endpoint is untouched.
const API_KEY = process.env.FMP_API_KEY;
const STABLE = "https://financialmodelingprep.com/stable";
const CACHE_TTL = 12 * 3600 * 1000; // 12h

// ticker -> { data: [[date, close], ...] ascending, timestamp }
const cache = new Map();

async function fetchAdj(ticker, from, attempt = 0) {
  try {
    const res = await fetch(
      `${STABLE}/historical-price-eod/dividend-adjusted?symbol=${ticker}&from=${from}&apikey=${API_KEY}`,
      { next: { revalidate: 43200 } }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data) || !data.length) throw new Error("empty");
    const rows = [];
    for (const r of data) if (r?.date && r.adjClose != null) rows.push([r.date, r.adjClose]);
    rows.sort((a, b) => (a[0] < b[0] ? -1 : 1));
    if (!rows.length) throw new Error("empty");
    return rows;
  } catch (e) {
    if (attempt < 2) {
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      return fetchAdj(ticker, from, attempt + 1);
    }
    return null;
  }
}

// Returns ascending [[date, adjClose], ...] for `ticker` since `from` (YYYY-MM-DD).
// Caches for 12h; on a failed refresh falls back to the last good copy.
export async function getAdjHistory(ticker, from) {
  const now = Date.now();
  const hit = cache.get(ticker);
  if (hit && now - hit.timestamp < CACHE_TTL) return hit.data;

  const fresh = await fetchAdj(ticker, from);
  if (fresh) {
    cache.set(ticker, { data: fresh, timestamp: now });
    return fresh;
  }
  // stale fallback
  return hit ? hit.data : null;
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
