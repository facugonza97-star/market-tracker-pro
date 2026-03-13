import { NextResponse } from "next/server";

const API_KEY = process.env.FMP_API_KEY;
let cache = { data: null, timestamp: 0 };
const CACHE_TTL = 10 * 60 * 1000; // 10 min

export async function GET() {
  const now = Date.now();
  if (cache.data && now - cache.timestamp < CACHE_TTL) {
    return NextResponse.json(cache.data);
  }
  try {
    const res = await fetch(
      `https://financialmodelingprep.com/stable/news/stock?limit=8&apikey=${API_KEY}`,
      { next: { revalidate: 600 } }
    );
    if (!res.ok) throw new Error("News fetch failed");
    const data = await res.json();
    cache = { data: data, timestamp: now };
    return NextResponse.json(data);
  } catch (error) {
    if (cache.data) return NextResponse.json(cache.data);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
