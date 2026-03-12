"use client";
import { useState, useEffect, useCallback } from "react";
import TrackerTable from "@/components/TrackerTable";
import SummaryCards from "@/components/SummaryCards";
import ForexStrip from "@/components/ForexStrip";
import YieldCurve from "@/components/YieldCurve";
import NewsPanel from "@/components/NewsPanel";
import Header from "@/components/Header";

const TABS = ["Overview", "Tracker", "Curves", "Forex", "Watchlist"];

export default function Home() {
  const [tab, setTab] = useState("Overview");
  const [quotes, setQuotes] = useState(null);
  const [treasury, setTreasury] = useState(null);
  const [news, setNews] = useState(null);
  const [forex, setForex] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);

  const fetchAll = useCallback(async () => {
    try {
      const [qRes, tRes, nRes, fRes] = await Promise.all([
        fetch("/api/quotes"),
        fetch("/api/treasury"),
        fetch("/api/news"),
        fetch("/api/forex"),
      ]);
      const [qData, tData, nData, fData] = await Promise.all([
        qRes.json(),
        tRes.json(),
        nRes.json(),
        fRes.json(),
      ]);
      setQuotes(qData);
      setTreasury(tData);
      setNews(nData);
      setForex(fData);
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
        <div className="px-6 py-5 space-y-4">
          <SummaryCards quotes={quotes} treasury={treasury} />
          <ForexStrip forex={forex} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <YieldCurve treasury={treasury} />
            <NewsPanel news={news} />
          </div>
          <TrackerTable quotes={quotes} />
        </div>
      )}

      {!loading && tab === "Tracker" && (
        <div className="px-6 py-5">
          <ForexStrip forex={forex} />
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
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <div className="text-4xl mb-4">⭐</div>
          <div className="text-lg font-semibold text-white mb-2">Watchlist</div>
          <div className="text-sm text-text-sec mb-5">Sign in to create your personal watchlist</div>
          <button className="bg-accent text-white px-8 py-2.5 rounded-lg text-sm font-semibold hover:bg-accent/80 transition">
            Sign in with Google
          </button>
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
