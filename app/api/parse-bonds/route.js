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
      ...bonds.map((b) => [b.EMISOR ?? "", b.CUPON ?? "", b.VENCIMIENTO ?? "", b.PRECIO ?? "", b.TIR ?? ""]),
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

function parseNum(val) {
  if (val === null || val === undefined || val === "") return null;
  if (typeof val === "number") return val;
  const clean = String(val).trim().replace(",", ".");
  const n = parseFloat(clean);
  return isNaN(n) ? null : n;
}

function extractYear(val) {
  if (!val) return null;
  if (val instanceof Date) return val.getFullYear();
  const str = String(val).trim();
  const parts = str.split("/");
  if (parts.length === 3) {
    const y = parseInt(parts[2]);
    if (y > 2000) return y;
  }
  const match = str.match(/\b(20\d{2})\b/);
  return match ? parseInt(match[1]) : null;
}

function formatDate(val) {
  if (!val) return "";
  if (val instanceof Date) {
    const d = val.getDate().toString().padStart(2, "0");
    const m = (val.getMonth() + 1).toString().padStart(2, "0");
    return `${d}/${m}/${val.getFullYear()}`;
  }
  return String(val).trim();
}

function processForFrontend(parsedData) {
  const sections = {};
  for (const sheetName of SHEET_NAMES) {
    const rows = parsedData[sheetName];
    if (!rows || rows.length === 0) continue;

    const bonds = [];
    for (const row of rows) {
      const emisor = (row.EMISOR ?? row.Emisor ?? row.emisor ?? "").toString().trim() || null;
      const cupon = parseNum(row.CUPON ?? row.Cupon ?? row.cupon);
      const vencRaw = row.VENCIMIENTO ?? row.Vencimiento ?? row.vencimiento;
      const precio = parseNum(row.PRECIO ?? row.Precio ?? row.precio);
      const tir = parseNum(row.TIR ?? row.Tir ?? row.tir ?? row["TIR %"]);
      const vencimiento = formatDate(vencRaw);
      const year = extractYear(vencRaw);

      if (tir === null || !year) continue;
      bonds.push({ emisor, cupon, vencimiento, year, precio, tir });
    }

    bonds.sort((a, b) => a.year - b.year);
    if (bonds.length > 0) sections[sheetName] = bonds;
  }
  return sections;
}

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });

    console.log("[parse-bonds] Workbook sheets:", workbook.SheetNames.join(", "));

    const parsedData = {};
    for (const sheetName of SHEET_NAMES) {
      if (!workbook.SheetNames.includes(sheetName)) {
        parsedData[sheetName] = [];
        continue;
      }
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      parsedData[sheetName] = rows;
      console.log(`[parse-bonds] Sheet "${sheetName}": ${rows.length} rows`);
    }

    // Save to Google Sheet in background (don't block response)
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
