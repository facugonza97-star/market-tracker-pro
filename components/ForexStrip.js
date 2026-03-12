"use client";

export default function ForexStrip({ forex, full }) {
  if (!forex || !Array.isArray(forex)) return null;

  return (
    <div className={`flex gap-2 overflow-x-auto pb-1 ${full ? "flex-wrap" : ""}`}>
      {forex.map((f, i) => (
        <div
          key={i}
          className={`bg-card border border-border rounded-lg px-3.5 py-2 flex items-center gap-2.5 ${
            full ? "min-w-[160px] flex-1" : "min-w-[120px]"
          }`}
        >
          <span className="text-base">{f.flag}</span>
          <div>
            <div className="text-[9px] text-text-dim tracking-wide">{f.name}</div>
            <div className="text-sm font-bold text-white font-mono">
              {f.price ? (f.price < 10 ? f.price.toFixed(4) : f.price.toFixed(2)) : "—"}
            </div>
          </div>
          {f.change !== null && (
            <span className={`text-[10px] font-medium ml-auto ${f.change >= 0 ? "text-pos/70" : "text-neg/70"}`}>
              {f.change >= 0 ? "+" : ""}{parseFloat(f.change).toFixed(1)}%
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
