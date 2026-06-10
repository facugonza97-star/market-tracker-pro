import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const API_KEY = process.env.FMP_API_KEY;

export async function GET(req) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) return NextResponse.json([]);

  try {
    const res = await fetch(
      `https://financialmodelingprep.com/stable/search-symbol?query=${encodeURIComponent(q)}&limit=10&apikey=${API_KEY}`,
      { next: { revalidate: 300 } }
    );
    if (!res.ok) return NextResponse.json([]);
    const data = await res.json();
    if (!Array.isArray(data)) return NextResponse.json([]);
    return NextResponse.json(
      data.map((d) => ({ ticker: d.symbol, name: d.name })).filter((d) => d.ticker)
    );
  } catch (e) {
    console.error("search-ticker error:", e);
    return NextResponse.json([]);
  }
}
