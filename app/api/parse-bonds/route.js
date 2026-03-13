import { NextResponse } from "next/server";
import pdfParse from "pdf-parse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

const US_SECTIONS = new Set(["US Treasuries", "US TIPS", "T-bills", "Strips"]);

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
  return upper.includes("CUPON") && (upper.includes("VENCIMIENTO") || upper.includes("TIR"));
}

function extractYear(dateStr) {
  if (!dateStr) return null;
  const parts = dateStr.split("/");
  if (parts.length === 3) {
    const y = parseInt(parts[2]);
    if (y > 2000) return y;
  }
  const match = dateStr.match(/\b(20\d{2})\b/);
  return match ? parseInt(match[1]) : null;
}

function parseBondText(text) {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const sections = {};
  let currentSection = null;

  // Debug: log first 50 lines
  console.log("=== BOND PDF TEXT (first 50 lines) ===");
  lines.slice(0, 50).forEach((l, i) => console.log(`L${i}: ${l}`));
  console.log("Total lines:", lines.length);

  for (const line of lines) {
    const section = findSection(line);
    if (section) {
      currentSection = section;
      if (!sections[currentSection]) sections[currentSection] = [];
      continue;
    }

    if (!currentSection) continue;
    if (isHeaderRow(line)) continue;

    // Find dates (DD/MM/YYYY)
    const dateMatches = line.match(/\d{1,2}\/\d{1,2}\/\d{4}/g);
    if (!dateMatches || dateMatches.length === 0) continue;

    // Split by whitespace and classify tokens
    const parts = line.split(/\s+/);
    const numbers = [];
    const dates = [];

    for (const part of parts) {
      if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(part)) {
        dates.push(part);
      } else {
        const n = parseNum(part);
        if (n !== null) numbers.push(n);
      }
    }

    if (dates.length === 0 || numbers.length < 2) continue;

    const isUS = US_SECTIONS.has(currentSection);

    // Vencimiento is always first date
    const vencimiento = dates[0];
    const year = extractYear(vencimiento);
    if (!year) continue;

    let cupon, precio, tir;

    if (isUS && dates.length >= 2) {
      // US: cupon, [vencimiento_date], precio, [trade_date], tir
      // numbers = [cupon, precio, tir] (trade date is a date token, not number)
      if (numbers.length >= 3) {
        cupon = numbers[0];
        precio = numbers[1];
        tir = numbers[numbers.length - 1];
      } else {
        cupon = null;
        precio = numbers[0];
        tir = numbers[numbers.length - 1];
      }
    } else {
      // Non-US: cupon, [vencimiento_date], precio, tir
      if (numbers.length >= 3) {
        cupon = numbers[0];
        precio = numbers[numbers.length - 2];
        tir = numbers[numbers.length - 1];
      } else {
        cupon = null;
        precio = numbers[0];
        tir = numbers[numbers.length - 1];
      }
    }

    if (tir === null || tir === undefined) continue;

    sections[currentSection].push({ cupon, vencimiento, year, precio, tir });
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
    const file = formData.get("file");
    if (!file) {
      return NextResponse.json({ error: "No PDF file provided" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const pdfData = await pdfParse(buffer);
    const text = pdfData.text;

    console.log("PDF parsed, text length:", text.length, "pages:", pdfData.numpages);

    const sections = parseBondText(text);

    // Log section counts
    for (const [k, v] of Object.entries(sections)) {
      console.log(`Section "${k}": ${v.length} bonds`);
    }

    return NextResponse.json(sections);
  } catch (error) {
    console.error("Parse bonds error:", error);
    return NextResponse.json({ error: "Failed to parse PDF: " + error.message }, { status: 500 });
  }
}
