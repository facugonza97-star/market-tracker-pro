// Client-side analytics for the Laboratorio tab. All computation runs on the
// raw [[date, adjClose], ...] series so changing period/frequency never refetches.

export const ANN = { D: 252, W: 52, M: 12 };

// ---- resampling -------------------------------------------------------------
function isoWeekKey(dateStr) {
  const d = new Date(dateStr + "T00:00:00Z");
  const day = (d.getUTCDay() + 6) % 7; // Mon=0
  d.setUTCDate(d.getUTCDate() - day + 3); // Thursday of this week
  const firstThu = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((d - firstThu) / 86400000 - 3 + ((firstThu.getUTCDay() + 6) % 7)) / 7);
  return `${d.getUTCFullYear()}-${String(week).padStart(2, "0")}`;
}

// series: [[date, close]] ascending → [[date, close]] at the requested frequency
// taking the LAST close of each bucket.
export function resample(series, freq) {
  if (freq === "D" || !series) return series || [];
  const keyer = freq === "W" ? isoWeekKey : (d) => d.slice(0, 7);
  const buckets = new Map();
  for (const [date, close] of series) buckets.set(keyer(date), [date, close]);
  return [...buckets.values()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
}

function simpleReturns(closes) {
  const r = [];
  for (let i = 1; i < closes.length; i++) r.push(closes[i] / closes[i - 1] - 1);
  return r;
}

function mean(a) {
  return a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;
}
function std(a) {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, x) => s + (x - m) * (x - m), 0) / (a.length - 1));
}

export function pearson(a, b) {
  const n = Math.min(a.length, b.length);
  if (n < 2) return null;
  const ma = mean(a), mb = mean(b);
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) {
    const x = a[i] - ma, y = b[i] - mb;
    num += x * y; da += x * x; db += y * y;
  }
  const den = Math.sqrt(da * db);
  return den > 0 ? num / den : null;
}

// ---- window cutoffs ---------------------------------------------------------
const WINDOW_DAYS = { "6M": 182, "1A": 365, "3A": 1095, "5A": 1825, "10A": 3650 };

function cutoffFrom(lastDateStr, windowKey) {
  if (windowKey === "Máx" || !WINDOW_DAYS[windowKey]) return null;
  const last = new Date(lastDateStr + "T00:00:00Z");
  return new Date(last.getTime() - WINDOW_DAYS[windowKey] * 86400000)
    .toISOString()
    .split("T")[0];
}

// ---- multi-asset alignment (correlation matrix) -----------------------------
// seriesMap: { ticker: [[date, close]] }, tickers: string[]
export function buildAligned(seriesMap, tickers, freq, windowKey) {
  const present = tickers.filter((t) => seriesMap[t] && seriesMap[t].length);
  if (present.length < 1) return null;

  const resampled = {};
  const maps = {};
  const firstDates = {};
  for (const t of present) {
    const rs = resample(seriesMap[t], freq);
    resampled[t] = rs;
    maps[t] = new Map(rs.map(([d, c]) => [d, c]));
    firstDates[t] = rs.length ? rs[0][0] : null;
  }

  // intersection of dates
  let common = resampled[present[0]].map(([d]) => d);
  for (let i = 1; i < present.length; i++) {
    const m = maps[present[i]];
    common = common.filter((d) => m.has(d));
  }
  common.sort();
  if (!common.length) return null;

  const lastDate = common[common.length - 1];
  const cutoff = cutoffFrom(lastDate, windowKey);
  const dates = cutoff ? common.filter((d) => d >= cutoff) : common;

  const closes = {};
  const returns = {};
  for (const t of present) {
    const c = dates.map((d) => maps[t].get(d));
    closes[t] = c;
    returns[t] = simpleReturns(c);
  }

  // which asset constrains the common start (latest first date)
  let limitedBy = present[0];
  for (const t of present) if (firstDates[t] > firstDates[limitedBy]) limitedBy = t;

  return {
    tickers: present,
    dates,
    closes,
    returns,
    n: Math.max(0, dates.length - 1),
    firstDate: dates[0],
    limitedBy,
    limitedByDate: firstDates[limitedBy],
  };
}

export function correlationMatrix(aligned) {
  const { tickers, returns } = aligned;
  return tickers.map((a) => tickers.map((b) => (a === b ? 1 : pearson(returns[a], returns[b]))));
}

// ---- rolling correlation (one pair) -----------------------------------------
export function rollingCorrelation(seriesMap, a, b, freq, windowKey, window) {
  const aligned = buildAligned(seriesMap, [a, b], freq, windowKey);
  if (!aligned || aligned.n < 2) return { points: [], avg: null, n: 0 };
  const ra = aligned.returns[a], rb = aligned.returns[b];
  const dates = aligned.dates.slice(1); // returns align to dates[1..]
  const points = [];
  for (let i = window - 1; i < ra.length; i++) {
    const c = pearson(ra.slice(i - window + 1, i + 1), rb.slice(i - window + 1, i + 1));
    if (c != null) points.push({ date: dates[i], value: c });
  }
  const avg = points.length ? mean(points.map((p) => p.value)) : null;
  return { points, avg, n: aligned.n };
}

// ---- drawdown ---------------------------------------------------------------
// Returns aligned [[date, dd]] where dd = close/prevMax - 1 (<= 0).
export function drawdownSeries(series) {
  const out = [];
  let max = -Infinity;
  for (const [date, close] of series) {
    if (close > max) max = close;
    out.push([date, close / max - 1]);
  }
  return out;
}

function daysBetween(a, b) {
  return Math.round((new Date(b + "T00:00:00Z") - new Date(a + "T00:00:00Z")) / 86400000);
}

// Per-asset drawdown metrics over a windowed series.
export function drawdownMetrics(series, freq) {
  if (!series || series.length < 2) return null;
  const closes = series.map((s) => s[1]);
  const rets = simpleReturns(closes);

  let max = series[0][1];
  let peakDate = series[0][0];
  let maxDD = 0, troughDate = series[0][0], troughVal = series[0][1];
  let ddPeakDate = series[0][0];
  for (const [date, close] of series) {
    if (close > max) { max = close; peakDate = date; }
    const dd = close / max - 1;
    if (dd < maxDD) { maxDD = dd; troughDate = date; troughVal = close; ddPeakDate = peakDate; }
  }
  // recovery: first date after trough reaching the pre-trough peak value
  const peakVal = series.find((s) => s[0] === ddPeakDate)[1];
  let recoveryDate = null;
  const tIdx = series.findIndex((s) => s[0] === troughDate);
  for (let i = tIdx + 1; i < series.length; i++) {
    if (series[i][1] >= peakVal) { recoveryDate = series[i][0]; break; }
  }

  const last = series[series.length - 1];
  const currentDD = last[1] / max - 1;
  const totalReturn = series[series.length - 1][1] / series[0][1] - 1;
  const volAnn = std(rets) * Math.sqrt(ANN[freq]);

  return {
    totalReturn,
    volAnn,
    maxDD,
    peakDate: ddPeakDate,
    troughDate,
    recoveryDate,
    daysToRecovery: recoveryDate ? daysBetween(ddPeakDate, recoveryDate) : null,
    currentDD,
  };
}

// 5 worst drawdown episodes for one asset.
export function worstEpisodes(series, k = 5) {
  if (!series || series.length < 2) return [];
  const episodes = [];
  let max = series[0][1];
  let peakDate = series[0][0];
  let inDD = false;
  let troughVal = Infinity, troughDate = null;
  for (let i = 0; i < series.length; i++) {
    const [date, close] = series[i];
    if (close >= max) {
      if (inDD) {
        episodes.push({
          peakDate,
          troughDate,
          recoveryDate: date,
          depth: troughVal / max - 1,
        });
        inDD = false;
      }
      max = close;
      peakDate = date;
      troughVal = Infinity;
      troughDate = null;
    } else {
      inDD = true;
      if (close < troughVal) { troughVal = close; troughDate = date; }
    }
  }
  if (inDD) {
    episodes.push({ peakDate, troughDate, recoveryDate: null, depth: troughVal / max - 1 });
  }
  return episodes.sort((a, b) => a.depth - b.depth).slice(0, k);
}

// windowed slice of a raw series for drawdown views
export function windowSeries(series, freq, windowKey) {
  const rs = resample(series, freq);
  if (!rs.length) return rs;
  const cutoff = cutoffFrom(rs[rs.length - 1][0], windowKey);
  return cutoff ? rs.filter(([d]) => d >= cutoff) : rs;
}
