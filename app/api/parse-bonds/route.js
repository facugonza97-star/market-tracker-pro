import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

function parseNum(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === "number") return val;
  const clean = String(val).trim().replace(",", ".");
  const n = parseFloat(clean);
  return isNaN(n) ? null : n;
}

function extractYear(val) {
  if (!val) return null;
  // If it's a Date object (Excel dates)
  if (val instanceof Date) return val.getFullYear();
  const str = String(val).trim();
  // DD/MM/YYYY
  const parts = str.split("/");
  if (parts.length === 3) {
    const y = parseInt(parts[2]);
    if (y > 2000) return y;
  }
  // Try ISO or other formats
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

function parseSheet(worksheet) {
  const rows = XLSX.utils.sheet_to_json(worksheet, { defval: null });
  const bonds = [];

  for (const row of rows) {
    // Try different possible column names (case-insensitive matching)
    const cupon = parseNum(row.CUPON ?? row.Cupon ?? row.cupon);
    const vencRaw = row.VENCIMIENTO ?? row.Vencimiento ?? row.vencimiento;
    const precio = parseNum(row.PRECIO ?? row.Precio ?? row.precio);
    const tir = parseNum(row.TIR ?? row.Tir ?? row.tir ?? row["TIR %"] ?? row["TIR%"]);

    const vencimiento = formatDate(vencRaw);
    const year = extractYear(vencRaw);

    if (tir === null || !year) continue;

    bonds.push({ cupon, vencimiento, year, precio, tir });
  }

  bonds.sort((a, b) => a.year - b.year);
  return bonds;
}

export async function POST(request) {
  console.log("[parse-bonds] POST received");
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    console.log("[parse-bonds] File:", file ? `${file.name} (${file.size} bytes)` : "NULL");
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });

    console.log("[parse-bonds] Workbook sheets:", workbook.SheetNames.join(", "));

    const sections = {};
    for (const name of SHEETS) {
      const ws = workbook.Sheets[name];
      if (!ws) {
        console.log(`[parse-bonds] Sheet "${name}": NOT FOUND`);
        continue;
      }
      const bonds = parseSheet(ws);
      console.log(`[parse-bonds] Sheet "${name}": ${bonds.length} bonds`);
      if (bonds.length > 0) {
        sections[name] = bonds;
      }
    }

    const summary = Object.entries(sections).map(([k, v]) => `${k}: ${v.length}`).join(", ");
    console.log("[parse-bonds] Result:", summary || "NO DATA");

    return NextResponse.json(sections);
  } catch (error) {
    console.error("[parse-bonds] ERROR:", error.message, error.stack);
    return NextResponse.json({ error: "Failed: " + error.message }, { status: 500 });
  }
}
