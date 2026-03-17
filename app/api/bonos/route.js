import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SHEET_ID = "1hwrHz_hsLhZVdYvh6MWxzxMOsgVo1D08Ckk0rGnHQgA";
const SHEETS = [
  "Uruguay USD",
  "Uruguay Pesos",
  "Notas UI",
  "Notas Pesos",
  "US Treasuries",
  "US TIPS",
  "T-bills",
  "Strips",
  "PEMEX",
  "Petrobras",
  "Brasil",
  "Ecopetrol",
  "Panama",
];

function sheetURL(name) {
  return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(name)}`;
}

function parseCSVLine(line) {
  const cells = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      cells.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  cells.push(current);
  return cells;
}

function parseNum(str) {
  if (!str) return null;
  const clean = str.replace(/"/g, "").trim().replace(",", ".");
  const n = parseFloat(clean);
  return isNaN(n) ? null : n;
}

function extractYear(dateStr) {
  if (!dateStr) return null;
  const clean = dateStr.replace(/"/g, "").trim();
  // DD/MM/YYYY
  const parts = clean.split("/");
  if (parts.length === 3) {
    const y = parseInt(parts[2]);
    if (y > 2000) return y;
  }
  const match = clean.match(/\b(20\d{2})\b/);
  return match ? parseInt(match[1]) : null;
}

function parseSheet(text) {
  const lines = text.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];

  // Columns: EMISOR, CUPON, VENCIMIENTO, ASK, BID, TIR
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCSVLine(lines[i]);
    if (cells.length < 6) continue;

    const emisor = (cells[0] || "").replace(/"/g, "").trim();
    const cupon = parseNum(cells[1]);
    const vencimiento = (cells[2] || "").replace(/"/g, "").trim();
    const precio = parseNum(cells[3]);
    const bid = parseNum(cells[4]);
    const tir = parseNum(cells[5]);
    const year = extractYear(vencimiento);

    if (tir === null || !year) continue;

    rows.push({ emisor: emisor || null, cupon, vencimiento, year, precio, bid, tir });
  }

  rows.sort((a, b) => a.year - b.year);
  return rows;
}

export async function GET() {
  try {
    const results = await Promise.all(
      SHEETS.map(async (name) => {
        try {
          const res = await fetch(sheetURL(name), { cache: "no-store" });
          if (!res.ok) return { name, rows: [] };
          const text = await res.text();
          return { name, rows: parseSheet(text) };
        } catch {
          return { name, rows: [] };
        }
      })
    );

    const sections = {};
    for (const { name, rows } of results) {
      if (rows.length > 0) sections[name] = rows;
    }

    return NextResponse.json(sections);
  } catch (error) {
    console.error("Bonos API error:", error);
    return NextResponse.json({}, { status: 500 });
  }
}
