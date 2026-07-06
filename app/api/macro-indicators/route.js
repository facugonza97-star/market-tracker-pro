import { NextResponse } from "next/server";
import { MACRO_INDICATORS, normalizeEvent } from "@/lib/macroConfig";

export const dynamic = "force-dynamic";

const API_KEY = process.env.FMP_API_KEY;
const STABLE = "https://financialmodelingprep.com/stable";

// Macro data changes at most a few times a week — cache aggressively to save FMP quota.
let cache = { data: null, timestamp: 0 };
const CACHE_TTL = 3600 * 1000; // 1 hour

function ymd(d) {
  return d.toISOString().split("T")[0];
}

export async function GET() {
  const now = Date.now();
  if (cache.data && now - cache.timestamp < CACHE_TTL) {
    return NextResponse.json(cache.data);
  }

  try {
    const today = new Date();
    // Wide window: back far enough to catch the last published print of monthly
    // indicators, forward enough to catch the next scheduled release.
    const from = ymd(new Date(today.getTime() - 120 * 86400000));
    const to = ymd(new Date(today.getTime() + 45 * 86400000));

    const res = await fetch(
      `${STABLE}/economic-calendar?from=${from}&to=${to}&apikey=${API_KEY}`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) {
      console.error("macro-indicators fetch failed:", res.status);
      if (cache.data) return NextResponse.json(cache.data);
      return NextResponse.json({ indicators: {}, updatedAt: null });
    }

    const raw = await res.json();
    const events = Array.isArray(raw) ? raw.filter((e) => e.country === "US") : [];

    // Pre-normalize once
    const normed = events.map((e) => ({ ...e, _norm: normalizeEvent(e.event) }));
    const nowTs = today.getTime();

    const indicators = {};
    for (const ind of MACRO_INDICATORS) {
      // Match by any accepted alias (first alias that yields data wins)
      let matches = [];
      for (const alias of ind.aliases) {
        matches = normed.filter((e) => e._norm === alias);
        if (matches.length) break;
      }

      const published = matches
        .filter((e) => e.actual !== null && e.actual !== undefined)
        .sort((a, b) => (a.date < b.date ? 1 : -1)); // newest first

      const upcoming = matches
        .filter((e) => (e.actual === null || e.actual === undefined) && new Date(e.date).getTime() >= nowTs)
        .sort((a, b) => (a.date > b.date ? 1 : -1)); // soonest first

      const latest = published[0] || null;

      indicators[ind.id] = {
        actual: latest ? latest.actual : null,
        previous: latest ? latest.previous : null,
        estimate: latest ? latest.estimate : null,
        date: latest ? latest.date : null,
        nextRelease: upcoming[0] ? upcoming[0].date : null,
      };
    }

    const result = { indicators, updatedAt: new Date().toISOString() };
    cache = { data: result, timestamp: now };
    return NextResponse.json(result);
  } catch (error) {
    console.error("macro-indicators error:", error.message);
    if (cache.data) return NextResponse.json(cache.data);
    return NextResponse.json({ indicators: {}, updatedAt: null });
  }
}
