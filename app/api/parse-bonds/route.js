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

// Excel sheet name → Google Sheet name (case-insensitive match on Excel side)
const EXCEL_TO_SHEET = {
  "URUGUAY USD": "Uruguay USD",
  "URUGUAY PESOS": "Uruguay Pesos",
  "NOTAS UI": "Notas UI",
  "NOTAS EN UI": "Notas UI",
  "NOTAS PESOS": "Notas Pesos",
  "US TREASURIES": "US Treasuries",
  "US TIPS": "US TIPS",
  "US T-BILLS": "T-bills",
  "US T BILLS": "T-bills",
  "STRIPS": "Strips",
  "CURVA PEMEX": "PEMEX",
  "PETROBRAS": "Petrobras",
  "BRASIL": "Brasil",
  "ECOPETROL": "Ecopetrol",
  "PANAMA": "Panama",
};

// Header keywords and aliases
const HEADER_KEYWORDS = {
  EMISOR: ["EMISOR"],
  CUPON: ["CUPON", "CUPÓN", "COUPON"],
  VENCIMIENTO: ["VENCIMIENTO", "MATURITY", "VTO"],
  BID: ["BID", "BID PRICE", "PRECIO COMPRA", "PRECIO DE COMPRA"],
  ASK: ["ASK", "ASK PRICE", "PRECIO VENTA", "PRECIO DE VENTA"],
  TIR: ["TIR", "TIR%", "TIR %", "YTM", "YIELD"],
};

// ============================================================
// Google Sheets client
// ============================================================

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
    // Only update sheets that have data — leave others untouched
    if (!bonds || bonds.length === 0) continue;

    const rows = [
      ["EMISOR", "CUPON", "VENCIMIENTO", "BID", "ASK", "TIR"],
      ...bonds.map((b) => [b.emisor ?? "", b.cupon ?? "", b.vencimiento ?? "", b.bid ?? "", b.ask ?? "", b.tir ?? ""]),
    ];

    try {
      await sheets.spreadsheets.values.clear({
        spreadsheetId: SHEET_ID,
        range: `'${sheetName}'!A:F`,
      });

      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `'${sheetName}'!A1`,
        valueInputOption: "RAW",
        requestBody: { values: rows },
      });
    } catch (err) {
      console.error(`[parse-bonds] Error writing sheet "${sheetName}":`, err.message);
    }
  }

  // Write timestamp to Uruguay USD!G1
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Montevideo" }));
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mi = String(now.getMinutes()).padStart(2, "0");
  const timestamp = `${dd}/${mm}/${now.getFullYear()} ${hh}:${mi}`;

  try {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: "'Uruguay USD'!G1",
      valueInputOption: "RAW",
      requestBody: { values: [[timestamp]] },
    });
  } catch (err) {
    console.error("[parse-bonds] Error writing timestamp:", err.message);
  }
}

// ============================================================
// Utility functions
// ============================================================

function isJunk(val) {
  if (val === null || val === undefined) return false;
  const str = String(val).trim();
  return str.startsWith("=") || str.includes("xll") || str.includes("BDP") || str.includes("Unable");
}

function cleanVal(val) {
  if (val === null || val === undefined || val === "") return null;
  if (isJunk(val)) return null;
  return val;
}

function parseNum(val) {
  const cleaned = cleanVal(val);
  if (cleaned === null) return null;
  if (typeof cleaned === "number") return isNaN(cleaned) ? null : cleaned;
  const str = String(cleaned).trim().replace(",", ".");
  const n = parseFloat(str);
  return isNaN(n) ? null : n;
}

function formatDate(val) {
  if (val === null || val === undefined || val === "") return null;
  // Date object from xlsx cellDates:true
  if (val instanceof Date && !isNaN(val)) {
    const d = val.getDate().toString().padStart(2, "0");
    const m = (val.getMonth() + 1).toString().padStart(2, "0");
    return `${d}/${m}/${val.getFullYear()}`;
  }
  const str = String(val).trim();
  if (isJunk(str)) return null;
  // DD/MM/YYYY
  const parts = str.split("/");
  if (parts.length === 3) {
    const dd = parseInt(parts[0]);
    const mm = parseInt(parts[1]);
    const yyyy = parseInt(parts[2]);
    if (!isNaN(dd) && !isNaN(mm) && !isNaN(yyyy) && yyyy > 2000) {
      return `${String(dd).padStart(2, "0")}/${String(mm).padStart(2, "0")}/${yyyy}`;
    }
  }
  // Try parsing as date string
  const d = new Date(str);
  if (!isNaN(d) && d.getFullYear() > 2000) {
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
  return String(val).trim().toUpperCase()
    .replace(/[áÁ]/g, "A").replace(/[éÉ]/g, "E")
    .replace(/[íÍ]/g, "I").replace(/[óÓ]/g, "O").replace(/[úÚ]/g, "U");
}

function detectHeaderRow(rows) {
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
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
// Parse rows into bonds
// ============================================================

function parseBondBlock(rows) {
  const detected = detectHeaderRow(rows);
  if (!detected) return [];

  const colMap = buildColumnMap(detected.cells);
  const bonds = [];

  for (let i = detected.headerIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !Array.isArray(row)) continue;

    // Skip any row where >50% of cells are junk (formula rows)
    const nonEmpty = row.filter((c) => c !== null && c !== undefined && c !== "");
    if (nonEmpty.length > 0 && nonEmpty.filter((c) => isJunk(c)).length > nonEmpty.length * 0.5) {
      console.log(`[parse-bonds] Skipped formula row ${i}`);
      continue;
    }

    try {
      const rawVenc = getVal(row, colMap, "VENCIMIENTO");
      const vencimiento = formatDate(rawVenc);
      if (!vencimiento) continue; // Must have valid date

      const bid = parseNum(getVal(row, colMap, "BID"));
      const ask = parseNum(getVal(row, colMap, "ASK"));
      if (ask === null) continue; // Must have valid ask price

      const rawEmisor = getVal(row, colMap, "EMISOR");
      const emisor = rawEmisor && !isJunk(rawEmisor) ? String(rawEmisor).trim() : null;

      const rawCupon = getVal(row, colMap, "CUPON");
      // Cupon 0 is valid (zero-coupon bonds)
      const cupon = cleanVal(rawCupon) !== null ? parseNum(rawCupon) : null;

      const rawTir = getVal(row, colMap, "TIR");
      const tir = parseNum(rawTir);

      bonds.push({ emisor, cupon, vencimiento, bid, ask, tir });
    } catch (err) {
      console.error(`[parse-bonds] Error parsing row ${i}:`, err.message);
      continue;
    }
  }

  return bonds;
}

// ============================================================
// Process for frontend (same format as BondPanel expects)
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

      const hoy = new Date();
      const [dd, mm, yyyy] = b.vencimiento.split("/").map(Number);
      const vencDate = new Date(yyyy, mm - 1, dd);
      if (vencDate <= hoy) continue; // Ignorar bonos ya vencidos

      processed.push({
        emisor: b.emisor,
        cupon: b.cupon,
        vencimiento: b.vencimiento,
        year,
        precio: b.ask,
        bid: b.bid,
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

    for (const excelSheet of workbook.SheetNames) {
      try {
        const nameUpper = excelSheet.trim().toUpperCase();

        // Find target sheet name
        const target = EXCEL_TO_SHEET[nameUpper];
        if (!target) {
          console.log(`[parse-bonds] Skipping unmapped sheet: "${excelSheet}"`);
          continue;
        }

        const sheet = workbook.Sheets[excelSheet];
        const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, blankrows: false });

        const bonds = parseBondBlock(rawRows);
        if (bonds.length > 0) {
          parsedData[target] = bonds;
          console.log(`[parse-bonds] "${excelSheet}" → "${target}": ${bonds.length} bonds`);
        } else {
          console.log(`[parse-bonds] "${excelSheet}" → "${target}": 0 bonds (no valid data)`);
        }
      } catch (err) {
        console.error(`[parse-bonds] Error processing sheet "${excelSheet}":`, err.message);
        continue;
      }
    }

    // Save to Google Sheet (only sheets with data)
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
    console.error("[parse-bonds] FATAL ERROR:", error.message);
    // Never 500 — return whatever we have
    return NextResponse.json({});
  }
}
