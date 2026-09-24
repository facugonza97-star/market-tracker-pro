import { NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";

export const dynamic = "force-dynamic";

// yahoo-finance2 v3 must be instantiated (never call .chart/.quote on the class).
const yahoo = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

// 60% MSCI ACWI (ACWI) + 40% Bloomberg Global Aggregate (BNDW proxy), rebalanced daily.
// Uses ADJUSTED close (total return: dividends/distributions + splits reinvested).
// FMP's EOD endpoint only exposes nominal close, which badly understates BNDW's
// total return (its monthly distributions drop the nominal price permanently),
// so both series come from Yahoo's adjusted close.
const W_ACWI = 0.6;
const W_BNDW = 0.4;

const CORS = {
  "Access-Control-Allow-Origin": "https://bengocheainversiones.com",
  "Access-Control-Allow-Methods": "GET",
};

let cache = { data: null, timestamp: 0 };
const CACHE_TTL = 12 * 3600 * 1000; // 12h

async function fetchAdjClose(symbol) {
  const r = await yahoo.chart(symbol, { period1: new Date("2015-01-01"), interval: "1d" });
  const map = {};
  for (const q of r?.quotes || []) {
    if (q?.date && q.adjclose != null) map[q.date.toISOString().slice(0, 10)] = q.adjclose;
  }
  return Object.keys(map).length ? map : null;
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
      const [acwi, bndw] = await Promise.all([fetchAdjClose("ACWI"), fetchAdjClose("BNDW")]);
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
