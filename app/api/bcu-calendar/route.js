import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/19C_ncF_8YYpHXVg8FtGaT9HtTO3e3OeWCvmv9y0L8Kg/gviz/tq?tqx=out:csv&sheet=BCU";

function parseCSV(text) {
  const lines = text.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]).map((h) => h.replace(/"/g, "").trim());

  const colFechaLic = headers.findIndex((h) => h.toUpperCase().includes("FECHA") && h.toUpperCase().includes("LIC"));
  const colFechaVenc = headers.findIndex((h) => h.toUpperCase().includes("FECHA") && h.toUpperCase().includes("VENC"));
  const colPlazo = headers.findIndex((h) => h.toUpperCase().includes("PLAZO"));
  const colMoneda = headers.findIndex((h) => h.toUpperCase().includes("MONEDA"));

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCSVLine(lines[i]);
    if (!cells.length) continue;

    const fechaLicitacion = cells[colFechaLic >= 0 ? colFechaLic : 0]?.replace(/"/g, "").trim() || "";
    const fechaVencimiento = cells[colFechaVenc >= 0 ? colFechaVenc : 1]?.replace(/"/g, "").trim() || "";
    const plazo = cells[colPlazo >= 0 ? colPlazo : 2]?.replace(/"/g, "").trim() || "";
    const moneda = cells[colMoneda >= 0 ? colMoneda : 3]?.replace(/"/g, "").trim() || "";

    if (!fechaLicitacion && !fechaVencimiento) continue;
    rows.push({ fechaLicitacion, fechaVencimiento, plazo, moneda });
  }

  return rows;
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

export async function GET() {
  try {
    const res = await fetch(SHEET_CSV_URL, { next: { revalidate: 3600 } });
    if (!res.ok) {
      console.error("BCU Sheet fetch failed:", res.status);
      return NextResponse.json([]);
    }
    const text = await res.text();
    const data = parseCSV(text);
    return NextResponse.json(data);
  } catch (error) {
    console.error("BCU calendar error:", error.message);
    return NextResponse.json([]);
  }
}
