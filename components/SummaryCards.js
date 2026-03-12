"use client";

export default function SummaryCards({ quotes, treasury }) {
  if (!quotes?.sections) return null;

  const findTicker = (ticker) => {
    for (const items of Object.values(quotes.sections)) {
      const found = items.find((i) => i.ticker === ticker);
      if (found) return found;
    }
    return null;
  };

  const cards = [];

  const sp = findTicker("^GSPC");
  cards.push({ label: "S&P 500", val: sp?.price, chg: sp?.d1, fmt: "price" });

  const nq = findTicker("^IXIC");
  cards.push({ label: "NASDAQ", val: nq?.price, chg: nq?.d1, fmt: "price" });

  const y10 = treasury?.year10 ? parseFloat(treasury.year10) : null;
  cards.push({ label: "US 10Y Yield", val: y10, chg: null, fmt: "yield" });

  const vix = findTicker("^VIX");
  cards.push({ label: "VIX", val: vix?.price, chg: vix?.d1, fmt: "decimal" });

  const btc = findTicker("IBIT");
  cards.push({ label: "BTC", val: btc?.price, chg: btc?.d1, fmt: "price" });

  const gold = findTicker("GLD");
  cards.push({ label: "Gold", val: gold?.price, chg: gold?.d1, fmt: "price" });

  const oil = findTicker("USO");
  cards.push({ label: "WTI", val: oil?.price, chg: oil?.d1, fmt: "price" });

  const format = (v, fmt) => {
    if (v === null || v === undefined) return "—";
    if (fmt === "yield") return v.toFixed(2) + "%";
    if (fmt === "price") return v >= 1000 ? v.toLocaleString("en", { maximumFractionDigits: 0 }) : v.toFixed(2);
    return v.toFixed(2);
  };

  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {cards.map((c, i) => (
        <div
          key={i}
          className="bg-card border border-border rounded-lg px-4 py-3 min-w-[130px] flex-1"
        >
          <div className="text-[10px] text-text-dim font-medium tracking-wide mb-1">{c.label}</div>
          <div className="text-lg font-bold text-white font-mono">{format(c.val, c.fmt)}</div>
          {c.chg !== null && c.chg !== undefined && (
            <div className={`text-[11px] font-medium mt-0.5 ${c.chg >= 0 ? "text-pos/80" : "text-neg/80"}`}>
              {c.chg >= 0 ? "+" : ""}{parseFloat(c.chg).toFixed(1)}%
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
