"use client";
import { heatColor, fmtPct, fmtPrice } from "@/lib/utils";

const COLS = [
  { key: "d1", label: "1D" },
  { key: "w1", label: "1W" },
  { key: "m1", label: "1M" },
  { key: "ytd", label: "YTD" },
  { key: "y1", label: "1Y" },
  { key: "y3", label: "3Y" },
];

function HeatCell({ val }) {
  const h = heatColor(val);
  return (
    <td
      className="px-1.5 py-2 text-center text-[11px] font-medium font-mono"
      style={{ backgroundColor: h.bg, color: h.color }}
    >
      {fmtPct(val)}
    </td>
  );
}

export default function ForexStrip({ forex, full }) {
  if (!forex || !Array.isArray(forex)) return null;

  if (full) {
    return (
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <p className="px-3 pt-3 pb-1 text-[13px] font-normal text-[#FFFFFF] leading-relaxed">
          Para pares USD/XXX: variación positiva indica apreciación del dólar.
          Para pares XXX/USD (EUR, GBP, AUD): variación positiva indica depreciación del dólar.
        </p>
        <table className="w-full">
          <thead>
            <tr style={{ backgroundColor: "#0d0d1a" }}>
              <th className="px-3 py-3 text-left text-[11px] font-bold text-white uppercase tracking-wider">Name</th>
              <th className="px-2 py-3 text-left text-[11px] font-bold text-white uppercase tracking-wider">Ticker</th>
              <th className="px-2 py-3 text-center text-[11px] font-bold text-white uppercase tracking-wider">Price</th>
              <th className="px-2 py-3 text-center text-[11px] font-bold text-white uppercase tracking-wider">52W Hi</th>
              <th className="px-2 py-3 text-center text-[11px] font-bold text-white uppercase tracking-wider">% 52WH</th>
              {COLS.map((c) => (
                <th key={c.key} className="px-1.5 py-3 text-center text-[11px] font-bold text-white uppercase tracking-wider">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {forex.map((f, i) => {
              const pct52 = f.yearHigh && f.price
                ? ((f.price / f.yearHigh - 1) * 100).toFixed(1)
                : null;
              return (
                <tr
                  key={i}
                  className={`border-b border-border hover:bg-card-hover ${i % 2 === 0 ? "" : "bg-white/[0.01]"}`}
                >
                  <td className="px-3 py-2 text-xs text-text-primary">
                    <span className="mr-1.5">{f.flag}</span>{f.name}
                  </td>
                  <td className="px-2 py-2 text-[11px] text-accent font-mono font-medium">{f.ticker}</td>
                  <td className="px-2 py-2 text-center text-xs text-white font-semibold font-mono">
                    {f.price ? (f.price < 10 ? f.price.toFixed(4) : f.price.toFixed(2)) : "—"}
                  </td>
                  <td className="px-2 py-2 text-center text-[11px] text-text-dim font-mono">
                    {f.yearHigh ? (f.yearHigh < 10 ? f.yearHigh.toFixed(4) : f.yearHigh.toFixed(2)) : "—"}
                  </td>
                  <HeatCell val={pct52} />
                  {COLS.map((c) => (
                    <HeatCell key={c.key} val={f[c.key]} />
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  const STRIP_TICKERS = ["USDUYU", "EURUSD", "USDBRL"];
  const stripForex = forex.filter((f) => STRIP_TICKERS.includes(f.ticker));

  return (
    <div className="grid grid-cols-3 gap-3">
      {stripForex.map((f, i) => (
        <div
          key={i}
          className="bg-card border border-border rounded-xl px-5 py-4 flex items-center gap-4"
        >
          <span className="text-2xl">{f.flag}</span>
          <div className="flex-1">
            <div className="text-xs text-text-dim font-semibold tracking-wide mb-0.5">{f.name}</div>
            <div className="text-xl font-bold text-white font-mono">
              {f.price ? (f.price < 10 ? f.price.toFixed(4) : f.price.toFixed(2)) : "—"}
            </div>
          </div>
          {f.change !== null && (
            <span className={`text-xs font-semibold ${f.change >= 0 ? "text-pos" : "text-neg"}`}>
              {f.change >= 0 ? "+" : ""}{parseFloat(f.change).toFixed(1)}%
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
