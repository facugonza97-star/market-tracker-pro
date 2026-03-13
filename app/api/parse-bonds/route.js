import { NextResponse } from "next/server";
import { extractText } from "unpdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Section markers in order of detection priority
// Longer/more specific matches first to avoid false positives
const SECTION_MARKERS = [
  { match: "BONOS GLOBALES URUGUAY EN USD", key: "Uruguay USD" },
  { match: "BONOS GLOBALES URUGUAY EN PESOS", key: "Uruguay Pesos" },
  { match: "NOTAS EN UNIDADES INDEXADAS", key: "Notas UI" },
  { match: "NOTAS EN PESOS URUGUAYOS", key: "Notas Pesos" },
  { match: "BONOS SOBERANOS EEUU LINKEADOS", key: "US TIPS" },
  { match: "LETRAS DEL TESORO EEUU", key: "T-bills" },
  { match: "BONOS CUPON CERO EEUU", key: "Strips" },
  { match: "BONOS CUPÓN CERO EEUU", key: "Strips" },
  { match: "BONOS SOBERANOS EEUU", key: "US Treasuries" },
  { match: "Curva PEMEX", key: "PEMEX" },
  { match: "Curva PETROBRAS", key: "Petrobras" },
  { match: "BONOS SOBERANOS BRASIL", key: "Brasil" },
  { match: "Curva BRASIL", key: "Brasil" },
  { match: "Curva Ecopetrol", key: "Ecopetrol" },
  { match: "Curva Panama", key: "Panama" },
];

function parseNum(str) {
  if (!str) return null;
  const clean = str.replace(",", ".");
  const n = parseFloat(clean);
  return isNaN(n) ? null : n;
}

function extractYear(dateStr) {
  if (!dateStr) return null;
  const parts = dateStr.split("/");
  if (parts.length === 3) {
    const y = parseInt(parts[2]);
    if (y > 2000) return y;
  }
  return null;
}

function parseBondText(text) {
  // Step 1: Find all section positions in the text
  const upperText = text.toUpperCase();
  const sectionPositions = [];

  for (const marker of SECTION_MARKERS) {
    const pos = upperText.indexOf(marker.match.toUpperCase());
    if (pos !== -1) {
      // Avoid duplicates for same key
      if (!sectionPositions.find((s) => s.key === marker.key)) {
        sectionPositions.push({ key: marker.key, pos });
      }
    }
  }

  // Sort by position in text
  sectionPositions.sort((a, b) => a.pos - b.pos);

  console.log("[parse-bonds] Section positions:", sectionPositions.map((s) => `${s.key}@${s.pos}`).join(", "));

  if (sectionPositions.length === 0) return {};

  // Step 2: Split text into sections
  const sections = {};
  for (let i = 0; i < sectionPositions.length; i++) {
    const start = sectionPositions[i].pos;
    const end = i + 1 < sectionPositions.length ? sectionPositions[i + 1].pos : text.length;
    const sectionText = text.substring(start, end);
    const key = sectionPositions[i].key;

    // Step 3: Extract bonds from section text using regex
    // Pattern: number(cupon) date(DD/MM/YYYY) number(precio) [optional date(trade)] number(tir)
    const bondRegex = /(\d+[,.]?\d*)\s+(\d{2}\/\d{2}\/\d{4})\s+(\d+[,.]?\d+)\s+(?:\d{2}\/\d{2}\/\d{4}\s+)?(\d+[,.]?\d+)/g;

    const bonds = [];
    let match;
    while ((match = bondRegex.exec(sectionText)) !== null) {
      const cupon = parseNum(match[1]);
      const vencimiento = match[2];
      const precio = parseNum(match[3]);
      const tir = parseNum(match[4]);
      const year = extractYear(vencimiento);

      if (year && tir !== null) {
        bonds.push({ cupon, vencimiento, year, precio, tir });
      }
    }

    // Sort by year
    bonds.sort((a, b) => a.year - b.year);
    if (bonds.length > 0) {
      sections[key] = bonds;
    }

    console.log(`[parse-bonds] Section "${key}": ${bonds.length} bonds found`);
    if (bonds.length > 0) {
      console.log(`[parse-bonds]   First: cupon=${bonds[0].cupon} venc=${bonds[0].vencimiento} precio=${bonds[0].precio} tir=${bonds[0].tir}`);
      console.log(`[parse-bonds]   Last:  cupon=${bonds[bonds.length - 1].cupon} venc=${bonds[bonds.length - 1].vencimiento} precio=${bonds[bonds.length - 1].precio} tir=${bonds[bonds.length - 1].tir}`);
    }
  }

  return sections;
}

export async function POST(request) {
  console.log("[parse-bonds] 1. POST request received");
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    console.log("[parse-bonds] 2. File:", file ? `${file.name} (${file.size} bytes)` : "NULL");
    if (!file) {
      return NextResponse.json({ error: "No PDF file provided" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);

    console.log("[parse-bonds] 3. Running unpdf...");
    let text;
    try {
      const result = await extractText(uint8, { mergePages: true });
      text = result.text;
    } catch (pdfErr) {
      console.error("[parse-bonds] unpdf ERROR:", pdfErr.message);
      return NextResponse.json({ error: "unpdf failed: " + pdfErr.message }, { status: 500 });
    }
    console.log("[parse-bonds] 4. Text extracted, length:", text.length);
    console.log("[parse-bonds] 5. Sample:", text.substring(0, 1000));

    const sections = parseBondText(text);

    const summary = Object.entries(sections).map(([k, v]) => `${k}: ${v.length}`).join(", ");
    console.log("[parse-bonds] 6. Result:", summary || "NO SECTIONS");

    return NextResponse.json(sections);
  } catch (error) {
    console.error("[parse-bonds] UNHANDLED:", error.message, error.stack);
    return NextResponse.json({ error: "Failed: " + error.message }, { status: 500 });
  }
}
