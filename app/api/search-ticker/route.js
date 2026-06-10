import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const API_KEY = process.env.FMP_API_KEY;
const STABLE = "https://financialmodelingprep.com/stable";

async function fmpSearch(path, q) {
  try {
    const res = await fetch(
      `${STABLE}/${path}?query=${encodeURIComponent(q)}&limit=10&apikey=${API_KEY}`,
      { next: { revalidate: 300 } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.error(`search-ticker (${path}) error:`, e);
    return [];
  }
}

export async function GET(req) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) return NextResponse.json([]);

  // Buscar por símbolo y por nombre en paralelo, luego fusionar sin duplicados
  const [bySymbol, byName] = await Promise.all([
    fmpSearch("search-symbol", q),
    fmpSearch("search-name", q),
  ]);

  const seen = new Set();
  const merged = [];
  for (const d of [...bySymbol, ...byName]) {
    if (!d.symbol || seen.has(d.symbol)) continue;
    seen.add(d.symbol);
    merged.push({ ticker: d.symbol, name: d.name });
    if (merged.length >= 10) break;
  }

  return NextResponse.json(merged);
}
