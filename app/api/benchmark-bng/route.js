import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const API_KEY = process.env.FMP_API_KEY;
const STABLE = "https://financialmodelingprep.com/stable";

// 60% MSCI ACWI (ACWI) + 40% Bloomberg Global Aggregate (BNDW proxy), rebalanced daily.
const W_ACWI = 0.6;
const W_BNDW = 0.4;

const CORS = {
  "Access-Control-Allow-Origin": "https://bengocheainversiones.com",
  "Access-Control-Allow-Methods": "GET",
};

// Cache the computed series (daily data — no need to refresh often).
let cache = { data: null, timestamp: 0 };
const CACHE_TTL = 12 * 3600 * 1000; // 12h

async function fetchEOD(symbol) {
  const res = await fetch(
    `${STABLE}/historical-price-eod/full?symbol=${symbol}&from=2015-01-01&apikey=${API_KEY}`,
    { next: { revalidate: 43200 } }
  );
  if (!res.ok) return null;
  const data = await res.json();
  if (!Array.isArray(data)) return null;
  const map = {};
  for (const r of data) if (r?.date && r.close != null) map[r.date] = r.close;
  return map;
}

function buildSeries(acwi, bndw) {
  // Common trading days (intersection), chronological. Skip days missing in either — no interpolation.
  const dates = Object.keys(acwi).filter((d) => bndw[d] != null).sort();
  const out = [];
  let index = 100;
  let prevA = null, prevB = null;
  for (const d of dates) {
    const a = acwi[d], b = bndw[d];
    if (prevA !== null && prevB !== null) {
      const rA = a / prevA - 1;
      const rB = b / prevB - 1;
      const rBench = W_ACWI * rA + W_BNDW * rB;
      index = index * (1 + rBench);
    }
    out.push({ date: d, value: +index.toFixed(4) });
    prevA = a;
    prevB = b;
  }
  return out;
}

export async function GET(req) {
  const now = Date.now();
  let series = null;

  if (cache.data && now - cache.timestamp < CACHE_TTL) {
    series = cache.data;
  } else {
    try {
      const [acwi, bndw] = await Promise.all([fetchEOD("ACWI"), fetchEOD("BNDW")]);
      if (!acwi || !bndw) throw new Error("history unavailable");
      series = buildSeries(acwi, bndw);
      if (!series.length) throw new Error("empty series");
      cache = { data: series, timestamp: now };
    } catch (error) {
      console.error("benchmark-bng API error:", error.message);
      if (cache.data) series = cache.data; // stale fallback
      else return NextResponse.json({ error: "Failed" }, { status: 500, headers: CORS });
    }
  }

  // Optional ?from=&to= filtering (YYYY-MM-DD, inclusive).
  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");
  let result = series;
  if (from) result = result.filter((p) => p.date >= from);
  if (to) result = result.filter((p) => p.date <= to);

  return NextResponse.json(result, { headers: CORS });
}
