"use client";
import { useState, useEffect, useCallback } from "react";
import TrackerTable from "@/components/TrackerTable";
import SummaryCards from "@/components/SummaryCards";
import ForexStrip from "@/components/ForexStrip";
import YieldCurve from "@/components/YieldCurve";
import NewsPanel from "@/components/NewsPanel";
import LRMPanel from "@/components/LRMPanel";
import EconCalendar from "@/components/EconCalendar";
import Header from "@/components/Header";

const TABS = ["Overview", "Tracker", "Curves", "Forex", "Watchlist"];

export default function Home() {
  const [tab, setTab] = useState("Overview");
  const [quotes, setQuotes] = useState(null);
  const [treasury, setTreasury] = useState(null);
  const [news, setNews] = useState(null);
  const [forex, setForex] = useState(null);
  const [macro, setMacro] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);

  const fetchAll = useCallback(async () => {
    try {
      const [qRes, tRes, nRes, fRes, mRes, mvRes] = await Promise.all([
        fetch("/api/quotes"),
        fetch("/api/treasury"),
        fetch("/api/news"),
        fetch("/api/forex"),
        fetch("/api/macro"),
      ]);
      const [qData, tData, nData, fData, mData] = await Promise.all([
        qRes.json(),
        tRes.json(),
        nRes.json(),
        fRes.json(),
        mRes.json(),
      ]);
      setQuotes(qData);
      setTreasury(tData);
      setNews(nData);
      setForex(fData);
      setMacro(mData);
      setLastUpdate(new Date());
      setLoading(false);
    } catch (e) {
      console.error("Fetch error:", e);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 5 * 60 * 1000); // refresh every 5 min
    return () => clearInterval(interval);
  }, [fetchAll]);

  return (
    <div className="min-h-screen bg-bg">
      <Header tab={tab} setTab={setTab} tabs={TABS} lastUpdate={lastUpdate} />

      {loading && (
        <div className="flex items-center justify-center h-64">
          <div className="text-text-sec text-sm">Loading market data...</div>
        </div>
      )}

      {!loading && tab === "Overview" && (
        <div className="px-8 py-6 space-y-6">
          <SummaryCards quotes={quotes} treasury={treasury} macro={macro} />
          <ForexStrip forex={forex} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <YieldCurve treasury={treasury} />
            <LRMPanel />
          </div>
          <EconCalendar />
        </div>
      )}

      {!loading && tab === "Tracker" && (
        <div className="px-6 py-5">
          <TrackerTable quotes={quotes} />
        </div>
      )}

      {!loading && tab === "Curves" && (
        <div className="px-6 py-5">
          <YieldCurve treasury={treasury} full />
        </div>
      )}

      {!loading && tab === "Forex" && (
        <div className="px-6 py-5">
          <ForexStrip forex={forex} full />
        </div>
      )}

      {!loading && tab === "Watchlist" && (
        <div className="flex flex-col items-center justify-center h-80 text-center">
          <div className="text-6xl mb-6">🚧</div>
          <div className="text-3xl font-bold text-white mb-3">En Construcción</div>
          <div className="text-lg text-[#CBD5E0] mb-2">"Facu está trabajando en esto... o eso dice."</div>
          <div className="text-lg text-[#CBD5E0]">"Mientras tanto, mirá el Overview que quedó hermoso."</div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-border px-6 py-4 mt-10 flex justify-between">
        <span className="text-[10px] text-text-dim">Data delayed ~15 min · Refresh every 5 min · Not investment advice</span>
        <span className="text-[10px] text-text-dim">Indicative quotes</span>
      </footer>
    </div>
  );
}
