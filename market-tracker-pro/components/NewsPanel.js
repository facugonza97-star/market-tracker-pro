"use client";
import { timeSince } from "@/lib/utils";

export default function NewsPanel({ news }) {
  if (!news || !Array.isArray(news)) return null;

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="text-xs font-semibold text-white mb-3">Market News</div>
      <div className="space-y-0">
        {news.slice(0, 6).map((n, i) => (
          <a
            key={i}
            href={n.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block py-2.5 border-b border-border last:border-0 hover:bg-card-hover -mx-2 px-2 rounded transition"
          >
            <div className="text-[11px] text-text-primary leading-relaxed line-clamp-2">
              {n.title}
            </div>
            <div className="text-[10px] text-text-dim mt-1">
              {n.site} · {timeSince(n.publishedDate)}
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
