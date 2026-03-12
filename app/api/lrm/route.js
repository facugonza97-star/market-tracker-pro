import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/19C_ncF_8YYpHXVg8FtGaT9HtTO3e3OeWCvmv9y0L8Kg/gviz/tq?tqx=out:csv&sheet=LRM";

const BUCKETS = [
  { label: "30d", min: 1, max: 35 },
  { label: "90d", min: 80, max: 100 },
  { label: "180d", min: 160, max: 200 },
  { label: "360d", min: 340, max: 370 },
];

const EMPTY_DATA = { curve: null, rows: [], updatedAt: null };

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
  if (lines.length < 2) return { curve: null, rows: [] };

  const headers = parseCSVLine(lines[0]).map((h) => h.replace(/"/g, "").trim().toUpperCase());
  console.log("LRM CSV headers:", headers);

  const colTipo = headers.findIndex((h) => h.includes("TIPO"));
  const colFecha = headers.findIndex((h) => h.includes("FECHA") && h.includes("LIC"));
  const colPlazo = headers.findIndex((h) => h.includes("PLAZO"));
  const colTasa = headers.findIndex((h) => h.includes("TASA") && h.includes("CORTE"));
  const colMonto = headers.findIndex((h) => h.includes("MONTO") && h.includes("ACEP"));
  console.log("LRM column indices - tipo:", colTipo, "fecha:", colFecha, "plazo:", colPlazo, "tasa:", colTasa, "monto:", colMonto);

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCSVLine(lines[i]);
    if (!cells.length) continue;

    const tipo = (cells[colTipo >= 0 ? colTipo : 0] || "").replace(/"/g, "").trim().toUpperCase();
    if (!tipo.includes("LRMMN") || tipo.includes("LRMMNNC")) continue;

    const plazo = parseFloat((cells[colPlazo >= 0 ? colPlazo : 2] || "").replace(/"/g, ""));
    const tasa = parseFloat((cells[colTasa >= 0 ? colTasa : 3] || "").replace(/"/g, ""));
    if (isNaN(plazo) || isNaN(tasa)) continue;

    const fecha = (cells[colFecha >= 0 ? colFecha : 1] || "").replace(/"/g, "").trim();
    const monto = parseFloat((cells[colMonto >= 0 ? colMonto : 4] || "").replace(/"/g, "")) || 0;

    rows.push({ tipo, fecha, plazo, tasa, monto });
  }

  rows.sort((a, b) => (b.fecha > a.fecha ? 1 : -1));
  console.log("LRM parsed rows:", rows.length, "first 3:", rows.slice(0, 3));

  const curve = BUCKETS.map((bucket) => {
    const match = rows.find((r) => r.plazo >= bucket.min && r.plazo <= bucket.max);
    return {
      label: bucket.label,
      rate: match ? match.tasa : null,
      plazo: match ? match.plazo : null,
      fecha: match ? match.fecha : null,
    };
  });
  console.log("LRM curve:", curve);

  return { curve, rows };
}

export async function GET() {
  try {
    const res = await fetch(SHEET_CSV_URL, { cache: "no-store" });
    if (!res.ok) {
      console.error("LRM Sheet fetch failed:", res.status);
      return NextResponse.json(EMPTY_DATA);
    }
    const text = await res.text();
    const parsed = parseSheetCSV(text);

    if (!parsed.rows.length) {
      return NextResponse.json(EMPTY_DATA);
    }

    return NextResponse.json({
      curve: parsed.curve,
      rows: parsed.rows,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("LRM error:", error.message);
    return NextResponse.json(EMPTY_DATA);
  }
}
