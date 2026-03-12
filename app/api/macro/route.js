import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/19C_ncF_8YYpHXVg8FtGaT9HtTO3e3OeWCvmv9y0L8Kg/gviz/tq?tqx=out:csv&sheet=MACRO";

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

function parseSheetCSV(text) {
  const lines = text.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return {};

  // Columns: A=INDICADOR, B=VALOR, C=VARIACION, D=PERIODO
  const result = {};
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCSVLine(lines[i]);
    if (!cells.length) continue;

    const indicador = (cells[0] || "").replace(/"/g, "").trim();
    const valor = parseFloat((cells[1] || "").replace(/"/g, "").replace(",", "."));
    const variacion = parseFloat((cells[2] || "").replace(/"/g, "").replace(",", "."));
    const periodo = (cells[3] || "").replace(/"/g, "").trim();

    if (!indicador) continue;
    result[indicador] = {
      valor: isNaN(valor) ? null : valor,
      variacion: isNaN(variacion) ? null : variacion,
      periodo,
    };
  }

  return result;
}

export async function GET() {
  try {
    const res = await fetch(SHEET_CSV_URL, { cache: "no-store" });
    if (!res.ok) {
      console.error("MACRO Sheet fetch failed:", res.status);
      return NextResponse.json({});
    }
    const text = await res.text();
    const data = parseSheetCSV(text);
    return NextResponse.json(data);
  } catch (error) {
    console.error("MACRO error:", error.message);
    return NextResponse.json({});
  }
}
