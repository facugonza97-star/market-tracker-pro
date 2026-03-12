"use client";

export default function SummaryCards({ quotes, forex }) {
  if (!quotes?.sections) return null;

  // Extract key data points
  const cards = [];
  const findTicker = (ticker) => {
    for (const items of Object.values(quotes.sections)) {
      const found = items.find((i) => i.ticker === ticker);
      if (found) return found;
    }
    return null;
  };

  const sp = findTicker("^GSPC");
  if (sp) cards.push({ label: "S&P 500", val: sp.price, chg: sp.ytd, fmt: "price" });

  const nq = findTicker("^IXIC");
  if (nq) cards.push({ label: "NASDAQ", val: nq.price, chg: nq.ytd, fmt: "price" });

  const vix = findTicker("^VIX");
  if (vix) cards.push({ label: "VIX", val: vix.price, chg: vix.d1, fmt: "decimal" });

  const btc = findTicker("IBIT");
  if (btc) cards.push({ label: "Bitcoin", val: btc.price, chg: btc.ytd, fmt: "price" });

  const gold = findTicker("GLD");
  if (gold) cards.push({ label: "Gold", val: gold.price, chg: gold.ytd, fmt: "price" });

  const oil = findTicker("USO");
  if (oil) cards.push({ label: "WTI", val: oil.price, chg: oil.ytd, fmt: "price" });

  // Forex
  if (forex && Array.isArray(forex)) {
    const uyu = forex.find((f) => f.name === "USD/UYU");
    if (uyu) cards.push({ label: "USD/UYU", val: uyu.price, chg: uyu.change, fmt: "fx" });
    const dxy = forex.find((f) => f.name === "DXY");
    if (dxy) cards.push({ label: "DXY", val: dxy.price, chg: dxy.change, fmt: "decimal" });
  }

  const format = (v, fmt) => {
    if (!v) return "—";
    if (fmt === "price") return v >= 1000 ? v.toLocaleString("en", { maximumFractionDigits: 0 }) : v.toFixed(2);
    if (fmt === "fx") return v.toFixed(2);
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
