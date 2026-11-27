import { NextResponse } from "next/server";
import { getAdjHistory, pool } from "@/lib/priceHistory";
import { isLabTicker, MAX_ASSETS } from "@/lib/labUniverse";

export const dynamic = "force-dynamic";

function ymd(d) {
  return d.toISOString().split("T")[0];
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const raw = (searchParams.get("tickers") || "").trim();
  let years = parseInt(searchParams.get("years") || "10", 10);
  if (!Number.isFinite(years) || years < 1) years = 10;
  years = Math.min(years, 10);

  const requested = raw
    ? raw.split(",").map((t) => t.trim().toUpperCase()).filter(Boolean)
    : [];
  // Validate against the closed universe; reject anything else.
  const valid = [...new Set(requested)].filter(isLabTicker).slice(0, MAX_ASSETS);

  if (!valid.length) {
    return NextResponse.json({ error: "no valid tickers", series: {} }, { status: 400 });
  }

  const from = ymd(new Date(Date.now() - years * 365 * 86400000));

  try {
    const results = await pool(valid, 6, (t) => getAdjHistory(t, from));
    const series = {};
    let lastDate = null;
    valid.forEach((t, i) => {
      const rows = results[i];
      if (rows && rows.length) {
        series[t] = rows; // [[date, adjClose], ...] ascending
        const d = rows[rows.length - 1][0];
        if (!lastDate || d > lastDate) lastDate = d;
      }
    });
    return NextResponse.json({ series, years, lastDate, updatedAt: new Date().toISOString() });
  } catch (error) {
    console.error("lab-history API error:", error.message);
    return NextResponse.json({ error: "fetch failed", series: {} }, { status: 500 });
  }
}
