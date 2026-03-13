import { NextResponse } from "next/server";
import pdf from "pdf-parse";

export const runtime = "nodejs";

const SECTION_TITLES = [
  { match: "BONOS GLOBALES URUGUAY EN USD", key: "Uruguay USD" },
  { match: "BONOS GLOBALES URUGUAY EN PESOS", key: "Uruguay Pesos" },
  { match: "NOTAS EN UNIDADES INDEXADAS", key: "Notas UI" },
  { match: "NOTAS EN PESOS URUGUAYOS", key: "Notas Pesos" },
  { match: "BONOS SOBERANOS EEUU", key: "US Treasuries" },
  { match: "US TIPS", key: "US TIPS" },
  { match: "LETRAS DEL TESORO EEUU", key: "T-bills" },
  { match: "BONOS CUPON CERO EEUU", key: "Strips" },
  { match: "BONOS CUPÓN CERO EEUU", key: "Strips" },
  { match: "Curva PEMEX", key: "PEMEX" },
  { match: "Curva PETROBRAS", key: "Petrobras" },
  { match: "BONOS SOBERANOS BRASIL", key: "Brasil" },
  { match: "Curva Ecopetrol", key: "Ecopetrol" },
  { match: "Curva Panama", key: "Panama" },
];

// US sections have an extra TRADE DATE column between PRECIO and TIR
const US_SECTIONS = ["US Treasuries", "US TIPS", "T-bills", "Strips"];

function parseNum(str) {
  if (!str) return null;
  const clean = str.trim().replace(",", ".");
  const n = parseFloat(clean);
  return isNaN(n) ? null : n;
}

function findSection(line) {
  const upper = line.toUpperCase();
  for (const s of SECTION_TITLES) {
    if (upper.includes(s.match.toUpperCase())) return s.key;
  }
  return null;
}

function isHeaderRow(line) {
  const upper = line.toUpperCase();
  return upper.includes("CUPON") || upper.includes("VENCIMIENTO") || upper.includes("EMISOR");
}

function extractYear(dateStr) {
  if (!dateStr) return null;
  // DD/MM/YYYY
  const parts = dateStr.split("/");
  if (parts.length === 3) {
    const y = parseInt(parts[2]);
    if (y > 2000) return y;
  }
  // YYYY-MM-DD
  const match = dateStr.match(/\b(20\d{2})\b/);
  return match ? parseInt(match[1]) : null;
}

function parseBondLines(text) {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const sections = {};
  let currentSection = null;

  console.log("=== BOND PDF RAW TEXT START ===");
  lines.forEach((line, i) => console.log(`LINE ${i}: ${line}`));
  console.log("=== BOND PDF RAW TEXT END ===");
  console.log("Total lines:", lines.length);

  for (const line of lines) {
    // Check if this line is a section header
    const section = findSection(line);
    if (section) {
      currentSection = section;
      if (!sections[currentSection]) sections[currentSection] = [];
      continue;
    }

    if (!currentSection) continue;
    if (isHeaderRow(line)) continue;

    // Try to extract bond data from line
    // Look for date pattern DD/MM/YYYY
    const dateMatch = line.match(/\d{1,2}\/\d{1,2}\/\d{4}/g);
    if (!dateMatch || dateMatch.length === 0) continue;

    // Extract all number-like tokens (including European comma decimals)
    const numPattern = /(?<!\d[\/])\b\d+[.,]?\d*\b(?![\/]\d)/g;
    const tokens = [];
    let m;

    // Split line by whitespace and process each token
    const parts = line.split(/\s+/);
    const numericParts = [];
    const dateParts = [];

    for (const part of parts) {
      if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(part)) {
        dateParts.push(part);
      } else {
        const n = parseNum(part);
        if (n !== null) numericParts.push(n);
      }
    }

    if (dateParts.length === 0 || numericParts.length < 2) continue;

    const isUS = US_SECTIONS.includes(currentSection);

    // For US sections with TRADE DATE: cupon, vencimiento(date), precio, tradeDate(date), tir
    // For non-US: cupon, vencimiento(date), precio, tir
    // The vencimiento date is always the first date
    const vencimiento = dateParts[0];
    const year = extractYear(vencimiento);
    if (!year) continue;

    let cupon, precio, tir;

    if (isUS && dateParts.length >= 2) {
      // US format: numbers are cupon, precio, tir (trade date is second date, skip it)
      if (numericParts.length >= 3) {
        cupon = numericParts[0];
        precio = numericParts[1];
        tir = numericParts[numericParts.length - 1];
      } else if (numericParts.length === 2) {
        cupon = null;
        precio = numericParts[0];
        tir = numericParts[1];
      } else continue;
    } else {
      // Non-US: cupon, precio, tir
      if (numericParts.length >= 3) {
        cupon = numericParts[0];
        precio = numericParts[numericParts.length - 2];
        tir = numericParts[numericParts.length - 1];
      } else if (numericParts.length === 2) {
        cupon = null;
        precio = numericParts[0];
        tir = numericParts[1];
      } else continue;
    }

    if (tir === null || tir === undefined) continue;

    sections[currentSection].push({
      cupon: cupon ?? null,
      vencimiento,
      year,
      precio: precio ?? null,
      tir,
    });
  }

  // Sort each section by year
  for (const key of Object.keys(sections)) {
    sections[key].sort((a, b) => a.year - b.year);
  }

  return sections;
}

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get("pdf");
    if (!file) {
      return NextResponse.json({ error: "No PDF file provided" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const data = await pdf(buffer);

    console.log("PDF parsed, text length:", data.text.length, "pages:", data.numpages);

    const sections = parseBondLines(data.text);

    return NextResponse.json(sections);
  } catch (error) {
    console.error("Parse bonds error:", error);
    return NextResponse.json({ error: "Failed to parse PDF" }, { status: 500 });
  }
}
