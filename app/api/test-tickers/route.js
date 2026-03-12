import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
const API_KEY = process.env.FMP_API_KEY;
const STABLE = "https://financialmodelingprep.com/stable";
async function probe(symbol) {
  try {
    const res = await fetch(`${STABLE}/quote?symbol=${encodeURIComponent(symbol)}&apikey=${API_KEY}`);
    const data = await res.json();
    const hit = Array.isArray(data) && data.length > 0 ? data[0] : null;
    return { symbol, price: hit?.price ?? null, name: hit?.name ?? null };
  } catch (e) {
    return { symbol, error: e.message };
  }
}
export async function GET() {
  const results = await Promise.all(["CLUSD", "USOIL", "WTIUSD"].map(probe));
  return NextResponse.json(results);
}
