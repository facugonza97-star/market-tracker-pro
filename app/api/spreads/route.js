import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Credit spreads from FRED (ICE BofA OAS indices) via the keyless CSV endpoint.
// These barely move intraday, so cache aggressively.
let cache = { data: null, timestamp: 0 };
const CACHE_TTL = 6 * 3600 * 1000; // 6 hours

function ymd(d) {
  return d.toISOString().split("T")[0];
}

// Fetch the latest valid observation for a FRED series (no API key needed).
async function fetchLatest(seriesId) {
  try {
    const cosd = ymd(new Date(Date.now() - 120 * 86400000)); // last ~120 days
    const res = await fetch(
      `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${seriesId}&cosd=${cosd}`,
      { next: { revalidate: CACHE_TTL / 1000 } }
    );
    if (!res.ok) return null;
    const text = await res.text();
    const lines = text.trim().split("\n").slice(1); // drop header row
    // Walk from the end to the last row with a numeric value ("." = missing).
    for (let i = lines.length - 1; i >= 0; i--) {
      const [date, raw] = lines[i].split(",");
      const val = parseFloat(raw);
      if (!isNaN(val)) return { value: val, date };
    }
    return null;
  } catch {
    return null;
  }
}

export async function GET() {
  const now = Date.now();
  if (cache.data && now - cache.timestamp < CACHE_TTL) {
    return NextResponse.json(cache.data);
  }

  try {
    const [ig, hy, em, euroHy, mortgage, dgs10] = await Promise.all([
      fetchLatest("BAMLC0A0CM"),
      fetchLatest("BAMLH0A0HYM2"),
      fetchLatest("BAMLEMCBPIOAS"),
      fetchLatest("BAMLHE00EHYIOAS"),
      fetchLatest("MORTGAGE30US"),
      fetchLatest("DGS10"),
    ]);

    // FRED values are in percent; ×100 → basis points.
    const toBps = (o) => (o && typeof o.value === "number" ? Math.round(o.value * 100) : null);

    const mortgageProxyBps =
      mortgage && dgs10 && typeof mortgage.value === "number" && typeof dgs10.value === "number"
        ? Math.round((mortgage.value - dgs10.value) * 100)
        : null;

    const rows = [
      { category: "US Investment Grade", bps: toBps(ig), date: ig?.date ?? null, source: "ICE BofA OAS (FRED)" },
      { category: "US High Yield", bps: toBps(hy), date: hy?.date ?? null, source: "ICE BofA OAS (FRED)" },
      { category: "EM Corporate", bps: toBps(em), date: em?.date ?? null, source: "ICE BofA OAS (FRED)" },
      { category: "Euro High Yield", bps: toBps(euroHy), date: euroHy?.date ?? null, source: "ICE BofA OAS (FRED)" },
      {
        category: "US Mortgage Rate Spread (primario, no es el OAS del índice)",
        bps: mortgageProxyBps,
        date: mortgage?.date ?? null,
        source: "Freddie Mac 30Y - DGS10 (FRED)",
      },
    ];

    const result = { rows, updatedAt: new Date().toISOString() };
    cache = { data: result, timestamp: now };
    return NextResponse.json(result);
  } catch (error) {
    console.error("spreads API error:", error.message);
    if (cache.data) return NextResponse.json(cache.data);
    return NextResponse.json({ rows: [], updatedAt: null });
  }
}
