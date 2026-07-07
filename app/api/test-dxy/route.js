import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const API_KEY = process.env.FMP_API_KEY;
const STABLE = "https://financialmodelingprep.com/stable";

// Temporary diagnostic endpoint: probe candidate DXY symbols against FMP /stable/quote.
// Real DXY today is ~97-99; anything far off (e.g. 103) is wrong data even on a 200.
const SYMBOLS = ["DXY", "DXYUSD", "DXY=F", "USDX", "DX-Y.NYB", "UUP"];

export async function GET() {
  const results = [];

  for (const symbol of SYMBOLS) {
    const url = `${STABLE}/quote?symbol=${encodeURIComponent(symbol)}&apikey=${API_KEY}`;
    try {
      const res = await fetch(url, { cache: "no-store" });
      const status = res.status;
      let body;
      const text = await res.text();
      try {
        body = JSON.parse(text);
      } catch {
        body = text; // keep raw text if not JSON
      }
      const price =
        Array.isArray(body) && body.length > 0 && typeof body[0]?.price === "number"
          ? body[0].price
          : null;
      results.push({ symbol, status, price, body });
    } catch (error) {
      results.push({ symbol, status: "fetch_error", price: null, body: String(error) });
    }
  }

  return NextResponse.json({ probedAt: new Date().toISOString(), results });
}
