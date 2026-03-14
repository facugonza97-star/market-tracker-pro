import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { google } from "googleapis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SHEET_ID = "1hwrHz_hsLhZVdYvh6MWxzxMOsgVo1D08Ckk0rGnHQgA";

const SHEET_NAMES = [
  "Uruguay USD", "Uruguay Pesos", "Notas UI", "Notas Pesos",
  "US Treasuries", "US TIPS", "T-bills", "Strips",
  "PEMEX", "Petrobras", "Brasil", "Ecopetrol", "Panama",
];

// Mapeo de hojas del Excel a hojas del Google Sheet
const DIRECT_SHEET_MAP = {
  "US TREASURIES": "US Treasuries",
  "CURVA PEMEX": "PEMEX",
  "PETROBRAS": "Petrobras",
  "BRASIL": "Brasil",
  "ECOPETROL": "Ecopetrol",
  "PANAMA": "Panama",
};

// Secciones dentro de la hoja URUGUAY del Excel
const URUGUAY_SECTIONS = [
  { marker: "BONOS GLOBALES URUGUAY EN USD", target: "Uruguay USD" },
  { marker: "BONOS GLOBALES URUGUAY EN PESOS", target: "Uruguay Pesos" },
  { marker: "NOTAS EN UNIDADES INDEXADAS", target: "Notas UI" },
  { marker: "NOTAS EN PESOS URUGUAYOS", target: "Notas Pesos" },
];

// Header keywords and aliases
const HEADER_KEYWORDS = {
  EMISOR: ["EMISOR"],
  CUPON: ["CUPON", "CUPÓN", "COUPON"],
  VENCIMIENTO: ["VENCIMIENTO", "MATURITY", "VTO"],
  PRECIO: ["PRECIO", "PRICE", "PX"],
  TIR: ["TIR", "TIR %", "YTM", "YIELD"],
};

async function getSheetsClient() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

async function saveToGoogleSheet(parsedData) {
  const sheets = await getSheetsClient();

  for (const sheetName of SHEET_NAMES) {
    const bonds = parsedData[sheetName];
    if (!bonds || bonds.length === 0) continue;

    const rows = [
      ["EMISOR", "CUPON", "VENCIMIENTO", "PRECIO", "TIR"],
      ...bonds.map((b) => [b.emisor ?? "", b.cupon ?? "", b.vencimiento ?? "", b.precio ?? "", b.tir ?? ""]),
    ];

    await sheets.spreadsheets.values.clear({
      spreadsheetId: SHEET_ID,
      range: `'${sheetName}'!A:E`,
    });

    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `'${sheetName}'!A1`,
      valueInputOption: "RAW",
      requestBody: { values: rows },
    });
  }

  // Write timestamp to Uruguay USD!G1
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mi = String(now.getMinutes()).padStart(2, "0");
  const timestamp = `${dd}/${mm}/${now.getFullYear()} ${hh}:${mi}`;

  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: "'Uruguay USD'!G1",
    valueInputOption: "RAW",
    requestBody: { values: [[timestamp]] },
  });
}

// ============================================================
// Utility functions
// ============================================================

function parseNum(val) {
  if (val === null || val === undefined || val === "") return null;
  if (typeof val === "number") return isNaN(val) ? null : val;
  const str = String(val).trim();
  // Ignore Bloomberg formulas
  if (str.startsWith("=")) return null;
  const clean = str.replace(",", ".");
  const n = parseFloat(clean);
  return isNaN(n) ? null : n;
}

function isFormula(val) {
  if (val === null || val === undefined) return false;
  return String(val).trim().startsWith("=");
}

function formatDate(val) {
  if (!val) return null;
  if (val instanceof Date && !isNaN(val)) {
    const d = val.getDate().toString().padStart(2, "0");
    const m = (val.getMonth() + 1).toString().padStart(2, "0");
    return `${d}/${m}/${val.getFullYear()}`;
  }
  const str = String(val).trim();
  if (str.startsWith("=")) return null;
  // Already DD/MM/YYYY
  const parts = str.split("/");
  if (parts.length === 3) {
    const dd = parseInt(parts[0]);
    const mm = parseInt(parts[1]);
    const yyyy = parseInt(parts[2]);
    if (!isNaN(dd) && !isNaN(mm) && !isNaN(yyyy) && yyyy > 2000) {
      return `${String(dd).padStart(2, "0")}/${String(mm).padStart(2, "0")}/${yyyy}`;
    }
  }
  // Try parsing as date
  const d = new Date(str);
  if (!isNaN(d)) {
    return formatDate(d);
  }
  return null;
}

function extractYear(vencimiento) {
  if (!vencimiento) return null;
  const parts = vencimiento.split("/");
  if (parts.length === 3) {
    const y = parseInt(parts[2]);
    if (y > 2000) return y;
  }
  return null;
}

// ============================================================
// Header detection
// ============================================================

function normalizeCell(val) {
  if (val === null || val === undefined) return "";
  return String(val).trim().toUpperCase().replace(/[áÁ]/g, "A").replace(/[óÓ]/g, "O").replace(/[úÚ]/g, "U");
}

function detectHeaderRow(rows) {
  // rows is an array of arrays (raw sheet data)
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const row = rows[i];
    if (!row || !Array.isArray(row)) continue;
    const cells = row.map(normalizeCell);
    let matchCount = 0;
    for (const [, aliases] of Object.entries(HEADER_KEYWORDS)) {
      if (cells.some((c) => aliases.some((a) => c === a || c.includes(a)))) {
        matchCount++;
      }
    }
    if (matchCount >= 2) {
      return { headerIndex: i, cells };
    }
  }
  return null;
}

function buildColumnMap(headerCells) {
  const map = {};
  for (const [field, aliases] of Object.entries(HEADER_KEYWORDS)) {
    for (let col = 0; col < headerCells.length; col++) {
      const cell = headerCells[col];
      if (aliases.some((a) => cell === a || cell.includes(a))) {
        map[field] = col;
        break;
      }
    }
  }
  return map;
}

function getVal(row, colMap, field) {
  const idx = colMap[field];
  if (idx === undefined || idx >= row.length) return null;
  const val = row[idx];
  if (val === null || val === undefined || val === "") return null;
  return val;
}

// ============================================================
// Parse a block of rows into bonds using auto-detected headers
// ============================================================

function parseBondBlock(rows) {
  // rows is array of arrays
  const detected = detectHeaderRow(rows);
  if (!detected) return [];

  const colMap = buildColumnMap(detected.cells);
  const bonds = [];

  for (let i = detected.headerIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !Array.isArray(row)) continue;

    const rawEmisor = getVal(row, colMap, "EMISOR");
    const rawCupon = getVal(row, colMap, "CUPON");
    const rawVenc = getVal(row, colMap, "VENCIMIENTO");
    const rawPrecio = getVal(row, colMap, "PRECIO");
    const rawTir = getVal(row, colMap, "TIR");

    // Skip rows with Bloomberg formulas
    if (isFormula(rawCupon) || isFormula(rawVenc) || isFormula(rawPrecio)) continue;

    // Parse vencimiento
    const vencimiento = formatDate(rawVenc);
    if (!vencimiento) continue;

    const cupon = parseNum(rawCupon);
    const precio = parseNum(rawPrecio);
    const tir = parseNum(rawTir);

    // Skip if precio is null/0 (cupon can be 0 for zero-coupon bonds)
    if (precio === null || precio === 0) continue;

    const emisor = rawEmisor ? String(rawEmisor).trim() : null;

    bonds.push({ emisor, cupon, vencimiento, precio, tir });
  }

  return bonds;
}

// ============================================================
// Parse URUGUAY sheet with multiple sections
// ============================================================

function parseUruguaySheet(sheetData) {
  // sheetData is array of arrays
  const result = {};
  for (const sec of URUGUAY_SECTIONS) {
    result[sec.target] = [];
  }

  // Find section boundaries by looking for marker strings in any cell
  const sectionStarts = [];
  for (let i = 0; i < sheetData.length; i++) {
    const row = sheetData[i];
    if (!row) continue;
    const joined = row.map((c) => normalizeCell(c)).join(" ");
    for (const sec of URUGUAY_SECTIONS) {
      if (joined.includes(sec.marker.toUpperCase())) {
        sectionStarts.push({ index: i, target: sec.target });
      }
    }
  }

  // Sort by index
  sectionStarts.sort((a, b) => a.index - b.index);

  // Extract each section's rows and parse
  for (let s = 0; s < sectionStarts.length; s++) {
    const start = sectionStarts[s].index;
    const end = s + 1 < sectionStarts.length ? sectionStarts[s + 1].index : sheetData.length;
    const sectionRows = sheetData.slice(start, end);
    const bonds = parseBondBlock(sectionRows);
    if (bonds.length > 0) {
      result[sectionStarts[s].target] = bonds;
    }
  }

  return result;
}

// ============================================================
// Process for frontend (same format as before)
// ============================================================

function processForFrontend(parsedData) {
  const sections = {};
  for (const sheetName of SHEET_NAMES) {
    const bonds = parsedData[sheetName];
    if (!bonds || bonds.length === 0) continue;

    const processed = [];
    for (const b of bonds) {
      const year = extractYear(b.vencimiento);
      if (!year) continue;
      // For frontend, require TIR
      if (b.tir === null) continue;
      processed.push({
        emisor: b.emisor,
        cupon: b.cupon,
        vencimiento: b.vencimiento,
        year,
        precio: b.precio,
        tir: b.tir,
      });
    }

    processed.sort((a, b) => a.year - b.year);
    if (processed.length > 0) sections[sheetName] = processed;
  }
  return sections;
}

// ============================================================
// POST handler
// ============================================================

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });

    console.log("[parse-bonds] Workbook sheets:", workbook.SheetNames.join(", "));

    const parsedData = {};
    // Initialize all targets
    for (const name of SHEET_NAMES) {
      parsedData[name] = [];
    }

    for (const excelSheet of workbook.SheetNames) {
      const sheet = workbook.Sheets[excelSheet];
      const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, blankrows: false });
      const nameUpper = excelSheet.trim().toUpperCase();

      // Check if this is the URUGUAY sheet
      if (nameUpper === "URUGUAY" || nameUpper === "URUGUAY USD" || nameUpper.includes("URUGUAY")) {
        // Check if it has section markers
        const joined = rawRows.map((r) => (r || []).map((c) => normalizeCell(c)).join(" ")).join(" ");
        const hasMarkers = URUGUAY_SECTIONS.some((sec) => joined.includes(sec.marker.toUpperCase()));

        if (hasMarkers) {
          const uruguayResult = parseUruguaySheet(rawRows);
          for (const [target, bonds] of Object.entries(uruguayResult)) {
            if (bonds.length > 0) {
              parsedData[target] = bonds;
              console.log(`[parse-bonds] URUGUAY section "${target}": ${bonds.length} bonds`);
            }
          }
          continue;
        }
      }

      // Check direct sheet mapping
      const mappedTarget = DIRECT_SHEET_MAP[nameUpper];
      if (mappedTarget) {
        const bonds = parseBondBlock(rawRows);
        if (bonds.length > 0) {
          parsedData[mappedTarget] = bonds;
          console.log(`[parse-bonds] Sheet "${excelSheet}" → "${mappedTarget}": ${bonds.length} bonds`);
        }
        continue;
      }

      // Try exact match with SHEET_NAMES (case-insensitive)
      const exactMatch = SHEET_NAMES.find((s) => s.toUpperCase() === nameUpper);
      if (exactMatch) {
        const bonds = parseBondBlock(rawRows);
        if (bonds.length > 0) {
          parsedData[exactMatch] = bonds;
          console.log(`[parse-bonds] Sheet "${excelSheet}" (exact): ${bonds.length} bonds`);
        }
        continue;
      }

      // Try partial match
      const partialMatch = SHEET_NAMES.find((s) =>
        nameUpper.includes(s.toUpperCase()) || s.toUpperCase().includes(nameUpper)
      );
      if (partialMatch && parsedData[partialMatch].length === 0) {
        const bonds = parseBondBlock(rawRows);
        if (bonds.length > 0) {
          parsedData[partialMatch] = bonds;
          console.log(`[parse-bonds] Sheet "${excelSheet}" → "${partialMatch}" (partial): ${bonds.length} bonds`);
        }
      }
    }

    // Save to Google Sheet
    try {
      await saveToGoogleSheet(parsedData);
      console.log("[parse-bonds] Saved to Google Sheet");
    } catch (sheetError) {
      console.error("[parse-bonds] Error saving to Sheet:", sheetError.message);
    }

    // Process for frontend display
    const sections = processForFrontend(parsedData);
    const summary = Object.entries(sections).map(([k, v]) => `${k}: ${v.length}`).join(", ");
    console.log("[parse-bonds] Result:", summary || "NO DATA");

    return NextResponse.json(sections);
  } catch (error) {
    console.error("[parse-bonds] ERROR:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
