// Closed universe for the Laboratorio tab. Only these tickers are accepted by
// /api/lab-history. Total return in USD (dividend-adjusted).
import { COUNTRY_ETFS } from "@/lib/countryEtfs";

// Fixed groups (US stocks, global, fixed income, commodities & dollar).
const FIXED_GROUPS = [
  {
    group: "Acciones EE.UU.",
    assets: [
      { ticker: "SPY", name: "S&P 500" },
      { ticker: "QQQ", name: "Nasdaq 100" },
      { ticker: "IWM", name: "Russell 2000" },
      { ticker: "RSP", name: "S&P 500 igual ponderado" },
    ],
  },
  {
    group: "Acciones globales",
    assets: [
      { ticker: "VT", name: "Mundo Total" },
      { ticker: "ACWX", name: "Mundo ex-EE.UU." },
      { ticker: "IEFA", name: "EAFE" },
      { ticker: "IEMG", name: "Emergentes" },
      { ticker: "VGK", name: "Europa" },
    ],
  },
  {
    group: "Renta fija",
    assets: [
      { ticker: "SHY", name: "Tesoro 1-3A" },
      { ticker: "IEF", name: "Tesoro 7-10A" },
      { ticker: "TLT", name: "Tesoro 20+A" },
      { ticker: "TIP", name: "TIPS" },
      { ticker: "AGG", name: "US Aggregate" },
      { ticker: "BNDW", name: "Bonos Mundo" },
      { ticker: "LQD", name: "Corp IG" },
      { ticker: "HYG", name: "Corp HY" },
      { ticker: "EMB", name: "Soberanos EM USD" },
    ],
  },
  {
    group: "Materias primas y dólar",
    assets: [
      { ticker: "GLD", name: "Oro" },
      { ticker: "SLV", name: "Plata" },
      { ticker: "USO", name: "Petróleo" },
      { ticker: "DBC", name: "Commodities" },
      { ticker: "UUP", name: "Dólar" },
    ],
  },
];

// Países group = every non-benchmark country ETF from countryEtfs.js.
const PAISES_GROUP = {
  group: "Países",
  assets: COUNTRY_ETFS.filter((e) => !e.aggregate).map((e) => ({
    ticker: e.ticker,
    name: e.name,
  })),
};

export const LAB_GROUPS = [
  FIXED_GROUPS[0],
  FIXED_GROUPS[1],
  PAISES_GROUP,
  FIXED_GROUPS[2],
  FIXED_GROUPS[3],
];

// Flat list and lookup.
export const LAB_ASSETS = LAB_GROUPS.flatMap((g) =>
  g.assets.map((a) => ({ ...a, group: g.group }))
);

const BY_TICKER = Object.fromEntries(LAB_ASSETS.map((a) => [a.ticker, a]));

export function isLabTicker(t) {
  return Object.prototype.hasOwnProperty.call(BY_TICKER, t);
}
export function labName(t) {
  return BY_TICKER[t]?.name || t;
}
export function labAsset(t) {
  return BY_TICKER[t] || null;
}

export const LAB_PRESETS = [
  { key: "Cartera clásica", tickers: ["SPY", "VGK", "IEMG", "AGG", "TLT", "HYG", "GLD"] },
  { key: "Acciones globales", tickers: ["SPY", "VGK", "EWJ", "IEMG", "MCHI", "EWZ"] },
  { key: "Latam", tickers: ["EWZ", "EWW", "ECH", "EPU", "COLO", "ARGT", "SPY"] },
  { key: "Renta fija", tickers: ["SHY", "IEF", "TLT", "TIP", "AGG", "LQD", "HYG", "EMB"] },
  { key: "Refugios", tickers: ["SPY", "GLD", "TLT", "UUP", "SHY"] },
  { key: "Commodities y dólar", tickers: ["SPY", "GLD", "SLV", "USO", "DBC", "UUP"] },
];

export const DEFAULT_PRESET = "Cartera clásica";
export const MAX_ASSETS = 12;
