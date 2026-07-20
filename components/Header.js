"use client";

export default function Header({ tab, setTab, tabs, lastUpdate, authSlot }) {
  return (
    <header className="h-12 bg-bbg-red border-b border-black/40 flex items-center px-6 justify-between sticky top-0 z-50">
      <div className="flex items-center gap-5">
        <span className="text-sm font-bold text-white tracking-tight">Market Tracker</span>
        <div className="w-px h-5 bg-white/20" />
        <nav className="flex">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                tab === t
                  ? "text-white border-accent font-semibold"
                  : "text-white/55 border-transparent hover:text-white"
              }`}
            >
              {t}
            </button>
          ))}
        </nav>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-[11px] text-text-dim font-mono flex items-center gap-2">
          <span className="text-pos text-[6px]">●</span>
          {lastUpdate
            ? `Updated ${lastUpdate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`
            : "Connecting..."}
        </div>
        {authSlot}
      </div>
    </header>
  );
}
