"use client";

export default function Header({ tab, setTab, tabs, lastUpdate }) {
  return (
    <header className="h-12 bg-surface border-b border-border flex items-center px-6 justify-between sticky top-0 z-50">
      <div className="flex items-center gap-5">
        <span className="text-sm font-bold text-white tracking-tight">Market Tracker</span>
        <div className="w-px h-5 bg-border" />
        <nav className="flex">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3.5 py-3 text-xs font-medium transition-colors border-b-2 ${
                tab === t
                  ? "text-white border-accent font-semibold"
                  : "text-text-sec border-transparent hover:text-white"
              }`}
            >
              {t}
            </button>
          ))}
        </nav>
      </div>
      <div className="text-[11px] text-text-dim font-mono flex items-center gap-2">
        <span className="text-pos text-[6px]">●</span>
        {lastUpdate
          ? `Updated ${lastUpdate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`
          : "Connecting..."}
      </div>
    </header>
  );
}
