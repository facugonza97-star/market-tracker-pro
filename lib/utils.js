export function heatColor(val) {
  if (val === null || val === undefined || isNaN(val)) return { bg: "transparent", color: "#6b7280" };
  const v = parseFloat(val);
  if (isNaN(v)) return { bg: "transparent", color: "#6b7280" };
  if (v < -10)  return { bg: "#640000", color: "#ffffff" };
  if (v < -5)   return { bg: "#8B0000", color: "#ffffff" };
  if (v < -2)   return { bg: "#B22222", color: "#ffffff" };
  if (v < -0.5) return { bg: "#CD5C5C", color: "#ffffff" };
  if (v < 0)    return { bg: "#6b2a2a", color: "#ffffff" };
  if (v > 10)   return { bg: "#006400", color: "#ffffff" };
  if (v > 5)    return { bg: "#228B22", color: "#ffffff" };
  if (v > 2)    return { bg: "#2E8B57", color: "#ffffff" };
  if (v > 0.5)  return { bg: "#3CB371", color: "#ffffff" };
  if (v > 0)    return { bg: "#2a6b3a", color: "#ffffff" };
  return { bg: "#2a2a2a", color: "#ffffff" };
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
