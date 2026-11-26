// Country / region equity ETFs used as market proxies. Total return in USD.
// region: "Américas" | "Europa" | "Asia-Pacífico" | "Medio Oriente y África"
// latam: true  → part of the Latam chip filter (subset of Américas)
// aggregate: true → benchmark/region ETF, shown in the fixed top block

export const COUNTRY_ETFS = [
  // Américas
  { ticker: "EWC", name: "Canadá", region: "Américas" },
  { ticker: "EPU", name: "Perú", region: "Américas", latam: true },
  { ticker: "COLO", name: "Colombia", region: "Américas", latam: true },
  { ticker: "ECH", name: "Chile", region: "Américas", latam: true },
  { ticker: "EWW", name: "México", region: "Américas", latam: true },
  { ticker: "EWZ", name: "Brasil", region: "Américas", latam: true },
  { ticker: "ARGT", name: "Argentina", region: "Américas", latam: true },

  // Europa
  { ticker: "EWP", name: "España", region: "Europa" },
  { ticker: "EPOL", name: "Polonia", region: "Europa" },
  { ticker: "GREK", name: "Grecia", region: "Europa" },
  { ticker: "EWO", name: "Austria", region: "Europa" },
  { ticker: "EWI", name: "Italia", region: "Europa" },
  { ticker: "EFNL", name: "Finlandia", region: "Europa" },
  { ticker: "EWD", name: "Suecia", region: "Europa" },
  { ticker: "EWG", name: "Alemania", region: "Europa" },
  { ticker: "EWK", name: "Bélgica", region: "Europa" },
  { ticker: "EWU", name: "Reino Unido", region: "Europa" },
  { ticker: "EWN", name: "Países Bajos", region: "Europa" },
  { ticker: "EWL", name: "Suiza", region: "Europa" },
  { ticker: "NORW", name: "Noruega", region: "Europa" },
  { ticker: "EWQ", name: "Francia", region: "Europa" },
  { ticker: "EIRL", name: "Irlanda", region: "Europa" },
  { ticker: "EDEN", name: "Dinamarca", region: "Europa" },

  // Asia-Pacífico
  { ticker: "EWY", name: "Corea del Sur", region: "Asia-Pacífico" },
  { ticker: "VNM", name: "Vietnam", region: "Asia-Pacífico" },
  { ticker: "EWH", name: "Hong Kong", region: "Asia-Pacífico" },
  { ticker: "EWS", name: "Singapur", region: "Asia-Pacífico" },
  { ticker: "MCHI", name: "China", region: "Asia-Pacífico" },
  { ticker: "EWT", name: "Taiwán", region: "Asia-Pacífico" },
  { ticker: "EWJ", name: "Japón", region: "Asia-Pacífico" },
  { ticker: "EWM", name: "Malasia", region: "Asia-Pacífico" },
  { ticker: "EWA", name: "Australia", region: "Asia-Pacífico" },
  { ticker: "EIDO", name: "Indonesia", region: "Asia-Pacífico" },
  { ticker: "INDA", name: "India", region: "Asia-Pacífico" },
  { ticker: "ENZL", name: "Nueva Zelanda", region: "Asia-Pacífico" },
  { ticker: "THD", name: "Tailandia", region: "Asia-Pacífico" },
  { ticker: "EPHE", name: "Filipinas", region: "Asia-Pacífico" },

  // Medio Oriente y África
  { ticker: "EZA", name: "Sudáfrica", region: "Medio Oriente y África" },
  { ticker: "EIS", name: "Israel", region: "Medio Oriente y África" },
  { ticker: "KWT", name: "Kuwait", region: "Medio Oriente y África" },
  { ticker: "UAE", name: "Emiratos Árabes", region: "Medio Oriente y África" },
  { ticker: "QAT", name: "Qatar", region: "Medio Oriente y África" },
  { ticker: "TUR", name: "Turquía", region: "Medio Oriente y África" },
  { ticker: "KSA", name: "Arabia Saudita", region: "Medio Oriente y África" },

  // Benchmarks y regiones (aggregate)
  { ticker: "VT", name: "Mundo Total", region: "Benchmarks", aggregate: true },
  { ticker: "SPY", name: "EE.UU.", region: "Benchmarks", aggregate: true },
  { ticker: "ACWX", name: "Mundo ex-EE.UU.", region: "Benchmarks", aggregate: true },
  { ticker: "IEFA", name: "EAFE", region: "Benchmarks", aggregate: true },
  { ticker: "IEMG", name: "Mercados Emergentes", region: "Benchmarks", aggregate: true },
  { ticker: "VGK", name: "Europa", region: "Benchmarks", aggregate: true },
  { ticker: "EZU", name: "Eurozona", region: "Benchmarks", aggregate: true },
];

export const REGION_CHIPS = ["Todos", "Américas", "Europa", "Asia-Pacífico", "Medio Oriente y África", "Latam"];
