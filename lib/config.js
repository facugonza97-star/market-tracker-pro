export const TICKER_CONFIG = {
  "MAJOR INDICES": [
    { name: "S&P 500", ticker: "^GSPC" },
    { name: "NASDAQ", ticker: "^IXIC" },
    { name: "VIX", ticker: "^VIX" },
    { name: "QQQ", ticker: "QQQ" },
    { name: "MSCI World", ticker: "URTH" },
    { name: "Russell 2000", ticker: "IWM" },
    { name: "Euro STOXX 50", ticker: "FEZ" },
    { name: "S&P 500 EW", ticker: "RSP" },
    { name: "EM Markets", ticker: "EEM" },
  ],
  "MAG 7": [
    { name: "NVIDIA", ticker: "NVDA" },
    { name: "Apple", ticker: "AAPL" },
    { name: "Google", ticker: "GOOG" },
    { name: "Microsoft", ticker: "MSFT" },
    { name: "Amazon", ticker: "AMZN" },
    { name: "Meta", ticker: "META" },
    { name: "Tesla", ticker: "TSLA" },
    { name: "MAG 7 ETF", ticker: "MAGS" },
  ],
  "COMMODITIES": [
    { name: "Oil (Brent)", ticker: "BNO" },
    { name: "Oil (WTI)", ticker: "USO" },
    { name: "Gold", ticker: "GLD" },
    { name: "Silver", ticker: "SLV" },
    { name: "Copper", ticker: "COPX" },
    { name: "Natural Gas", ticker: "UNG" },
    { name: "Broad Commodities", ticker: "DJP" },
  ],
  "CRYPTO": [
    { name: "Bitcoin", ticker: "IBIT" },
    { name: "Ethereum", ticker: "ETHA" },
    { name: "Coinbase", ticker: "COIN" },
    { name: "Circle", ticker: "CRCL" },
    { name: "Mara", ticker: "MARA" },
    { name: "Riot", ticker: "RIOT" },
    { name: "MicroStrategy", ticker: "MSTR" },
    { name: "SharLink", ticker: "SBET" },
    { name: "Bitmine", ticker: "BMNR" },
  ],
  "EUROPE": [
    { name: "UK (FTSE)", ticker: "EWU" },
    { name: "France (CAC)", ticker: "EWQ" },
    { name: "Germany (DAX)", ticker: "EWG" },
    { name: "Netherlands", ticker: "EWN" },
    { name: "Spain (IBEX)", ticker: "EWP" },
    { name: "Italy", ticker: "EWI" },
    { name: "Switzerland", ticker: "EWL" },
  ],
  "ASIA": [
    { name: "Japan", ticker: "EWJ" },
    { name: "South Korea", ticker: "EWY" },
    { name: "India", ticker: "INDA" },
    { name: "China", ticker: "MCHI" },
    { name: "Hong Kong", ticker: "EWH" },
    { name: "Taiwan", ticker: "EWT" },
  ],
  "LATAM": [
    { name: "Brazil", ticker: "EWZ" },
    { name: "Mexico", ticker: "EWW" },
    { name: "Argentina", ticker: "ARGT" },
    { name: "Chile", ticker: "ECH" },
  ],
  "US SECTORS": [
    { name: "Technology", ticker: "XLK" },
    { name: "Healthcare", ticker: "XLV" },
    { name: "Financials", ticker: "XLF" },
    { name: "Consumer Disc.", ticker: "XLY" },
    { name: "Comm. Services", ticker: "XLC" },
    { name: "Industrials", ticker: "XLI" },
    { name: "Consumer Staples", ticker: "XLP" },
    { name: "Energy", ticker: "XLE" },
    { name: "Utilities", ticker: "XLU" },
    { name: "Real Estate", ticker: "XLRE" },
    { name: "Materials", ticker: "XLB" },
  ],
  "EU SECTORS": [
    { name: "EU Banks", ticker: "EUFN" },
    { name: "EU Healthcare", ticker: "IXJ" },
    { name: "EU Technology", ticker: "IXN" },
    { name: "EU Energy", ticker: "IXC" },
  ],
  "THEMATIC": [
    { name: "Semiconductors", ticker: "SMH" },
    { name: "Clean Energy", ticker: "ICLN" },
    { name: "AI & Robotics", ticker: "BOTZ" },
    { name: "Cybersecurity", ticker: "HACK" },
    { name: "Biotech", ticker: "XBI" },
    { name: "Dividend Aristo.", ticker: "NOBL" },
  ],
};

// Tickers to show earnings for
export const EARNINGS_TICKERS = ["NVDA", "AAPL", "GOOG", "MSFT", "AMZN", "META", "TSLA"];

// Forex pairs
export const FOREX_CONFIG = [
  { name: "EUR/USD", ticker: "EURUSD", flag: "🇪🇺" },
  { name: "GBP/USD", ticker: "GBPUSD", flag: "🇬🇧" },
  { name: "USD/JPY", ticker: "USDJPY", flag: "🇯🇵" },
  { name: "USD/CHF", ticker: "USDCHF", flag: "🇨🇭" },
  { name: "AUD/USD", ticker: "AUDUSD", flag: "🇦🇺" },
  { name: "USD/CAD", ticker: "USDCAD", flag: "🇨🇦" },
  { name: "USD/BRL", ticker: "USDBRL", flag: "🇧🇷" },
  { name: "USD/UYU", ticker: "USDUYU", flag: "🇺🇾" },
  { name: "USD/ARS", ticker: "USDARS", flag: "🇦🇷" },
  { name: "USD/MXN", ticker: "USDMXN", flag: "🇲🇽" },
  { name: "USD/CNY", ticker: "USDCNY", flag: "🇨🇳" },
];

// Extra tickers for summary cards
export const SUMMARY_TICKERS = ["^GSPC", "^IXIC", "^VIX", "BTCUSD", "GCUSD"];
