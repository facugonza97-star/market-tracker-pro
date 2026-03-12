"use client";

function MoverTable({ title, items, color }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <span className="text-[20px] font-semibold text-white block mb-4">{title}</span>
      {items.length > 0 ? (
        <table className="w-full">
          <thead>
            <tr style={{ backgroundColor: "#0d0d1a" }}>
              <th className="px-3 py-2 text-left text-xs font-bold text-white uppercase tracking-wide">Name</th>
              <th className="px-3 py-2 text-left text-xs font-bold text-white uppercase tracking-wide">Ticker</th>
              <th className="px-3 py-2 text-right text-xs font-bold text-white uppercase tracking-wide">Price</th>
              <th className="px-3 py-2 text-right text-xs font-bold text-white uppercase tracking-wide">Chg %</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i} className={`border-b border-border ${i % 2 === 0 ? "" : "bg-white/[0.01]"}`}>
                <td className="px-3 py-2 text-xs text-white truncate max-w-[140px]">{item.name}</td>
                <td className="px-3 py-2 text-xs text-accent font-mono font-medium">{item.symbol}</td>
                <td className="px-3 py-2 text-right text-xs text-white font-mono">
                  {item.price != null ? item.price.toFixed(2) : "—"}
                </td>
                <td className={`px-3 py-2 text-right text-xs font-semibold font-mono ${color}`}>
                  {item.change != null
                    ? `${item.change >= 0 ? "+" : ""}${parseFloat(item.change).toFixed(1)}%`
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="text-xs text-text-dim">No data available</div>
      )}
    </div>
  );
}

export default function Movers({ movers }) {
  if (!movers) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <MoverTable title="Top Gainers" items={movers.gainers || []} color="text-pos" />
      <MoverTable title="Top Losers" items={movers.losers || []} color="text-neg" />
    </div>
  );
}
