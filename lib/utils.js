export function heatColor(val) {
  if (val === null || val === undefined || isNaN(val)) return { bg: "transparent", color: "#6b7280" };
  const v = parseFloat(val);
  if (v < -10) return { bg: "#5c1a1a", color: "#ffffff" };
  if (v < -5)  return { bg: "#712222", color: "#ffffff" };
  if (v < -2)  return { bg: "#8a2d2d", color: "#ffffff" };
  if (v < -0.5) return { bg: "#3a1a1a", color: "#f87171" };
  if (v < 0)   return { bg: "#200f0f", color: "#6b7280" };
  if (v < 0.5) return { bg: "#0f2018", color: "#6b7280" };
  if (v < 2)   return { bg: "#1a3a2a", color: "#6ee7b7" };
  if (v < 5)   return { bg: "#2d8a4e", color: "#ffffff" };
  if (v < 10)  return { bg: "#22713a", color: "#ffffff" };
  return { bg: "#1a5c2a", color: "#ffffff" };
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
