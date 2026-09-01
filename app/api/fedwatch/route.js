import { NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";

export const dynamic = "force-dynamic";

const yahoo = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

const FRED_CSV = "https://fred.stlouisfed.org/graph/fredgraph.csv";
const STEP = 0.25;
const LOW_LIQ_OI = 50000; // open interest below this → flag as low liquidity

// FOMC decision dates (day 2 of each meeting). Published ~a year ahead; hardcoded.
const FOMC_DATES = [
  "2026-01-28", "2026-03-18", "2026-04-29", "2026-06-17",
  "2026-07-29", "2026-09-16", "2026-10-28", "2026-12-09",
  "2027-01-27", "2027-03-17", "2027-04-28", "2027-06-16",
  "2027-07-28", "2027-09-15", "2027-10-27", "2027-12-08",
  "2028-01-26", "2028-03-15",
];

const MONTH_CODE = ["F", "G", "H", "J", "K", "M", "N", "Q", "U", "V", "X", "Z"];
const MONTHS_ES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

// ZQ (30-Day Fed Funds) contract symbol for a given year/month (1-12).
function zqSymbol(year, month1) {
  return `ZQ${MONTH_CODE[month1 - 1]}${String(year).slice(-2)}.CBT`;
}
function daysInMonth(year, month1) {
  return new Date(year, month1, 0).getDate();
}
function fmtRange(lower) {
  return `${lower.toFixed(2)}–${(lower + STEP).toFixed(2)}%`;
}

async function fredLatest(seriesId) {
  try {
    const cosd = new Date(Date.now() - 120 * 86400000).toISOString().split("T")[0];
    const res = await fetch(`${FRED_CSV}?id=${seriesId}&cosd=${cosd}`, { next: { revalidate: 43200 } });
    if (!res.ok) return null;
    const lines = (await res.text()).trim().split("\n").slice(1);
    for (let i = lines.length - 1; i >= 0; i--) {
      const v = parseFloat(lines[i].split(",")[1]);
      if (!isNaN(v)) return v;
    }
    return null;
  } catch {
    return null;
  }
}

let cache = { data: null, timestamp: 0 };
const CACHE_TTL = 12 * 3600 * 1000; // 12h

export async function GET() {
  const now = Date.now();
  if (cache.data && now - cache.timestamp < CACHE_TTL) {
    return NextResponse.json(cache.data);
  }

  try {
    const [upper, lower] = await Promise.all([fredLatest("DFEDTARU"), fredLatest("DFEDTARL")]);
    if (upper == null || lower == null) throw new Error("FRED target range unavailable");
    const curLower = lower;
    const curMid = curLower + STEP / 2;

    // Meetings within the next ~12 months.
    const today = new Date();
    const horizon = new Date(today.getTime() + 375 * 86400000);
    const meetings = FOMC_DATES
      .map((d) => new Date(d + "T00:00:00Z"))
      .filter((dt) => dt > today && dt <= horizon)
      .map((dt) => {
        const y = dt.getUTCFullYear(), m = dt.getUTCMonth() + 1, day = dt.getUTCDate();
        const nextY = m === 12 ? y + 1 : y, nextM = m === 12 ? 1 : m + 1;
        return {
          date: dt.toISOString().split("T")[0],
          y, m, day,
          contract: zqSymbol(y, m),
          nextClean: zqSymbol(nextY, nextM), // month after (no FOMC there for late-month meetings)
          label: `${day} ${MONTHS_ES[m - 1]}`,
        };
      });

    // Fetch every contract we need in one batch.
    const syms = [...new Set(meetings.flatMap((mt) => [mt.contract, mt.nextClean]))];
    const quotes = {};
    await Promise.all(
      syms.map(async (s) => {
        try {
          const r = await yahoo.quote(s);
          quotes[s] = r?.regularMarketPrice != null
            ? { price: r.regularMarketPrice, oi: r.openInterest ?? null, vol: r.regularMarketVolume ?? null }
            : null;
        } catch {
          quotes[s] = null;
        }
      })
    );

    // Sequential post-meeting rate + binomial tree over target ranges.
    let preRate = curMid;
    let dist = new Map([[curLower, 1]]);
    const out = [];

    for (const mt of meetings) {
      const c = quotes[mt.contract];
      if (!c || c.price == null) continue;

      const D = daysInMonth(mt.y, mt.m);
      const effDay = mt.day + 1;            // new rate effective the day after the decision
      const postDays = D - effDay + 1;
      const ER = 100 - c.price;             // implied average fed funds rate for the month

      let post;
      if (postDays >= 5) {
        post = (ER * D - preRate * (effDay - 1)) / postDays;
      } else if (quotes[mt.nextClean]?.price != null) {
        // Meeting in the last days of the month → the next (clean) month reflects the post rate.
        post = 100 - quotes[mt.nextClean].price;
      } else {
        post = ER;
      }

      let moves = (post - preRate) / STEP;
      if (moves > 4) moves = 4;
      if (moves < -4) moves = -4;

      // Single-meeting distribution between the two adjacent 25bp outcomes.
      const f = Math.floor(moves), c2 = Math.ceil(moves);
      const stepDist = new Map();
      if (f === c2) stepDist.set(f, 1);
      else { stepDist.set(c2, moves - f); stepDist.set(f, c2 - moves); }

      // Convolve into the cumulative distribution over absolute target ranges.
      const nd = new Map();
      for (const [rl, p] of dist) {
        for (const [st, ps] of stepDist) {
          const k = +(rl + st * STEP).toFixed(2);
          nd.set(k, (nd.get(k) || 0) + p * ps);
        }
      }
      dist = nd;
      preRate = post;

      const ranges = [...dist.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([rl, p]) => ({ lower: rl, label: fmtRange(rl), prob: +(p * 100).toFixed(1) }));

      out.push({
        date: mt.date,
        label: mt.label,
        contract: mt.contract,
        oi: c.oi,
        lowLiquidity: c.oi != null && c.oi < LOW_LIQ_OI,
        ranges,
      });
    }

    const result = {
      currentRange: { lower: curLower, upper, label: `${curLower.toFixed(2)}–${upper.toFixed(2)}%` },
      meetings: out,
      updatedAt: new Date().toISOString(),
    };
    cache = { data: result, timestamp: now };
    return NextResponse.json(result);
  } catch (error) {
    console.error("fedwatch API error:", error.message);
    if (cache.data) return NextResponse.json(cache.data);
    return NextResponse.json({ error: "Failed", currentRange: null, meetings: [] }, { status: 500 });
  }
}
