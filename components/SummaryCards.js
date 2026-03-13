"use client";

export default function SummaryCards({ quotes, treasury, macro }) {
  if (!quotes?.sections) return null;

  const findTicker = (ticker) => {
    for (const items of Object.values(quotes.sections)) {
      const found = items.find((i) => i.ticker === ticker);
      if (found) return found;
    }
    if (quotes.summaryQuotes?.[ticker]) return quotes.summaryQuotes[ticker];
    return null;
  };

  const cards = [];

  const sp = findTicker("^GSPC");
  cards.push({ label: "S&P 500", val: sp?.price, chg: sp?.d1, fmt: "price" });

  const nq = findTicker("^IXIC");
  cards.push({ label: "NASDAQ", val: nq?.price, chg: nq?.d1, fmt: "price" });

  const y10 = treasury?.year10 ? parseFloat(treasury.year10) : null;
  const y10prev = treasury?._prev?.year10 ? parseFloat(treasury._prev.year10) : null;
  const y10bps = y10 !== null && y10prev !== null ? Math.round((y10 - y10prev) * 100) : null;
  cards.push({ label: "US 10Y Yield", val: y10, chg: null, fmt: "yield", bps: y10bps });

  const vix = findTicker("^VIX");
  cards.push({ label: "VIX", val: vix?.price, chg: vix?.d1, fmt: "decimal" });

  const btc = findTicker("BTCUSD");
  cards.push({ label: "Bitcoin", val: btc?.price, chg: btc?.d1, fmt: "price" });

  const gold = findTicker("GCUSD");
  cards.push({ label: "Gold", val: gold?.price, chg: gold?.d1, fmt: "price" });

  // Macro cards from Google Sheet
  const ipcUY = macro?.["IPC Uruguay"];
  if (ipcUY) {
    cards.push({ label: "🇺🇾 IPC Uruguay", val: ipcUY.valor, chg: ipcUY.variacion, fmt: "yield", sub: ipcUY.periodo });
  }

  const ipcUS = macro?.["IPC USA"];
  if (ipcUS) {
    cards.push({ label: "🇺🇸 IPC USA", val: ipcUS.valor, chg: ipcUS.variacion, fmt: "yield", sub: ipcUS.periodo });
  }

  const format = (v, fmt) => {
    if (v === null || v === undefined) return "—";
    if (fmt === "yield") return v.toFixed(2) + "%";
    if (fmt === "price") return v >= 1000 ? v.toLocaleString("en", { maximumFractionDigits: 0 }) : v.toFixed(2);
    return v.toFixed(2);
  };

  return (
    <div className="flex gap-3 overflow-x-auto pb-1">
      {cards.map((c, i) => (
        <div
          key={i}
          className="bg-card border border-border rounded-xl px-5 py-3.5 min-w-[140px] flex-1"
        >
          <div className="text-[11px] text-text-dim font-semibold tracking-wide mb-1">{c.label}</div>
          <div className="text-xl font-bold text-white font-mono">{format(c.val, c.fmt)}</div>
          {c.chg !== null && c.chg !== undefined && (
            <div className={`text-xs font-semibold mt-0.5 ${c.chg >= 0 ? "text-pos" : "text-neg"}`}>
              {c.chg >= 0 ? "+" : ""}{parseFloat(c.chg).toFixed(1)}%
            </div>
          )}
          {c.bps !== null && c.bps !== undefined && (
            <div className={`text-xs font-semibold mt-0.5 ${c.bps >= 0 ? "text-pos" : "text-neg"}`}>
              {c.bps >= 0 ? "+" : ""}{c.bps} bps
            </div>
          )}
          {c.sub && (
            <div className="text-[10px] text-text-sec mt-0.5">{c.sub}</div>
          )}
        </div>
      ))}
    </div>
  );
}
