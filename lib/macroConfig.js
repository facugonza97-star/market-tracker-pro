// Macro indicators config — shared by the API route (matching) and MacroPanel (rendering).
//
// `aliases` are normalized FMP event names (lowercase, punctuation/space stripped).
// FMP event names carry a month suffix like "(Jun)" and inconsistent spacing
// (e.g. "Non Farm Payrolls"), so matching is done on the normalized base name.
//
// `favorable` is explicit per indicator — it drives the green/red badge:
//   "down" → a decrease is good (green), an increase is bad (red)
//   "up"   → an increase is good (green), a decrease is bad (red)

export function normalizeEvent(name) {
  return String(name || "")
    .replace(/\([^)]*\)/g, "")     // drop "(Jun)", "(Aug/01)" suffixes
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");    // strip spaces/punctuation → robust matching
}

export const MACRO_CATEGORIES = [
  {
    name: "Job Market",
    icon: "💼",
    indicators: [
      { id: "unemployment", label: "Unemployment Rate", unit: "%", favorable: "down", aliases: ["unemploymentrate"] },
      { id: "jobless", label: "Initial Jobless Claims", unit: "K", favorable: "down", aliases: ["initialjoblessclaims"] },
      { id: "nfp", label: "Nonfarm Payrolls", unit: "K", favorable: "up", aliases: ["nonfarmpayrolls"] },
    ],
  },
  {
    name: "Inflation",
    icon: "🔥",
    indicators: [
      { id: "cpi", label: "CPI YoY", unit: "%", favorable: "down", aliases: ["cpiyoy"] },
      { id: "corecpi", label: "Core CPI YoY", unit: "%", favorable: "down", aliases: ["corecpiyoy", "coreinflationrateyoy"] },
      // FMP has no plain headline "PPI MoM"; the closest published series is Core PPI MoM.
      { id: "ppi", label: "PPI MoM", unit: "%", favorable: "down", aliases: ["ppimom", "coreppimom"] },
    ],
  },
  {
    name: "Economic Activities",
    icon: "📈",
    indicators: [
      { id: "ismmfg", label: "ISM Manufacturing PMI", unit: "", favorable: "up", aliases: ["ismmanufacturingpmi"] },
      { id: "ismnonmfg", label: "ISM Non-Manufacturing PMI", unit: "", favorable: "up", aliases: ["ismnonmanufacturingpmi", "ismservicespmi"] },
      { id: "chicago", label: "Chicago PMI", unit: "", favorable: "up", aliases: ["chicagopmi"] },
      { id: "confidence", label: "Consumer Confidence", unit: "", favorable: "up", aliases: ["cbconsumerconfidence", "consumerconfidence"] },
    ],
  },
];

// Flat list of every indicator (with its aliases) for the API matching pass.
export const MACRO_INDICATORS = MACRO_CATEGORIES.flatMap((c) => c.indicators);
