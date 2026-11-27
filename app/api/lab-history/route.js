import { NextResponse } from "next/server";
import { getSeries, getProfileName, hasFresh, tryReserveNew, pool } from "@/lib/priceHistory";
import { isLabTicker, labName, MAX_ASSETS } from "@/lib/labUniverse";

export const dynamic = "force-dynamic";

const TICKER_RE = /^[A-Z0-9.^-]{1,12}$/;

function ymd(d) {
  return d.toISOString().split("T")[0];
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const raw = (searchParams.get("tickers") || "").trim();
  let years = parseInt(searchParams.get("years") || "10", 10);
  if (!Number.isFinite(years) || years < 1) years = 10;
  years = Math.min(years, 10);

  // normalize to uppercase, accept universe tickers or anything matching the format
  const requested = raw
    ? raw.split(",").map((t) => t.trim().toUpperCase()).filter(Boolean)
    : [];
  const valid = [...new Set(requested)]
    .filter((t) => isLabTicker(t) || TICKER_RE.test(t))
    .slice(0, MAX_ASSETS);

  if (!valid.length) {
    return NextResponse.json({ error: "no valid tickers", series: {} }, { status: 400 });
  }

  // rate-limit off-universe ("new") tickers that need a fresh fetch
  const newNeedFetch = valid.filter((t) => !isLabTicker(t) && !hasFresh(t));
  if (newNeedFetch.length && !tryReserveNew(newNeedFetch)) {
    return NextResponse.json(
      { error: "rate_limit", message: "Límite de tickers nuevos, probá más tarde." },
      { status: 429 }
    );
  }

  const from = ymd(new Date(Date.now() - years * 365 * 86400000));

  try {
    const results = await pool(valid, 6, (t) => getSeries(t, from));
    const series = {};
    const meta = {};
    const failed = [];
    let lastDate = null;

    for (let i = 0; i < valid.length; i++) {
      const t = valid[i];
      const r = results[i];
      if (r && r.rows && r.rows.length) {
        series[t] = r.rows;
        meta[t] = { adjusted: r.adjusted };
        const d = r.rows[r.rows.length - 1][0];
        if (!lastDate || d > lastDate) lastDate = d;
      } else {
        failed.push(t);
      }
    }

    // names: universe uses its Spanish label; off-universe uses /profile
    const names = {};
    const offUniverse = valid.filter((t) => !isLabTicker(t) && series[t]);
    const profNames = await pool(offUniverse, 4, (t) => getProfileName(t));
    offUniverse.forEach((t, i) => { names[t] = profNames[i]; });
    for (const t of valid) if (isLabTicker(t)) names[t] = labName(t);

    return NextResponse.json({ series, meta, names, failed, years, lastDate, updatedAt: new Date().toISOString() });
  } catch (error) {
    console.error("lab-history API error:", error.message);
    return NextResponse.json({ error: "fetch failed", series: {} }, { status: 500 });
  }
}
