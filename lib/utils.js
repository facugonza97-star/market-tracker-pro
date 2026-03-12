export function heatColor(val) {
  if (val === null || val === undefined || isNaN(val)) return { bg: "transparent", text: "text-text-dim" };
  const v = parseFloat(val);
  if (v <= -20) return { bg: "bg-red-900/40", text: "text-red-300" };
  if (v <= -10) return { bg: "bg-red-900/25", text: "text-red-400" };
  if (v <= -3) return { bg: "bg-red-900/15", text: "text-red-400" };
  if (v < 0) return { bg: "bg-red-900/8", text: "text-red-400/80" };
  if (v === 0) return { bg: "transparent", text: "text-text-dim" };
  if (v < 3) return { bg: "bg-green-900/8", text: "text-green-400/80" };
  if (v < 10) return { bg: "bg-green-900/15", text: "text-green-400" };
  if (v < 20) return { bg: "bg-green-900/25", text: "text-green-400" };
  return { bg: "bg-green-900/40", text: "text-green-300" };
}

export function fmtPct(val) {
  if (val === null || val === undefined || isNaN(val)) return "—";
  const v = parseFloat(val);
  return (v >= 0 ? "+" : "") + v.toFixed(1) + "%";
}

export function fmtPrice(val) {
  if (!val || isNaN(val)) return "—";
  const v = parseFloat(val);
  if (v >= 10000) return v.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (v >= 100) return v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (v >= 1) return v.toFixed(2);
  return v.toFixed(4);
}

export function timeSince(dateStr) {
  const now = new Date();
  const date = new Date(dateStr);
  const diff = Math.floor((now - date) / 1000);
  if (diff < 3600) return Math.floor(diff / 60) + "m";
  if (diff < 86400) return Math.floor(diff / 3600) + "h";
  return Math.floor(diff / 86400) + "d";
}
