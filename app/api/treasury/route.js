import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const API_KEY = process.env.FMP_API_KEY;
let cache = { data: null, timestamp: 0 };
const CACHE_TTL = 30 * 60 * 1000; // 30 min

export async function GET() {
  const now = Date.now();
  if (cache.data && now - cache.timestamp < CACHE_TTL) {
    return NextResponse.json(cache.data);
  }
  try {
    const res = await fetch(
      `https://financialmodelingprep.com/stable/treasury-rates?apikey=${API_KEY}`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) throw new Error("Treasury fetch failed");
    const data = await res.json();
    const latest = Array.isArray(data) ? data[0] : data;
    const prev = Array.isArray(data) && data.length > 1 ? data[1] : null;
    const result = { ...latest };
    if (prev) result._prev = prev;
    cache = { data: result, timestamp: now };
    return NextResponse.json(result);
  } catch (error) {
    console.error("Treasury API error:", error);
    if (cache.data) return NextResponse.json(cache.data);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
