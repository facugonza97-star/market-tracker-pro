import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/19C_ncF_8YYpHXVg8FtGaT9HtTO3e3OeWCvmv9y0L8Kg/gviz/tq?tqx=out:csv&sheet=LRM";

const BUCKETS = [
  { label: "30d", min: 1, max: 45 },
  { label: "90d", min: 60, max: 120 },
  { label: "180d", min: 150, max: 210 },
  { label: "360d", min: 330, max: 400 },
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
  console.log("LRM CSV total lines:", lines.length);
  console.log("LRM CSV line 0 (header):", lines[0]);
  console.log("LRM CSV line 1:", lines[1] || "EMPTY");
  console.log("LRM CSV line 2:", lines[2] || "EMPTY");
  if (lines.length < 2) return { curve: null, rows: [] };

  // Log parsed cells for first 3 data rows
  for (let k = 1; k <= 3 && k < lines.length; k++) {
    const c = parseCSVLine(lines[k]);
    console.log(`LRM row ${k} cells [0,3,6,7]:`, c[0], "|", c[3], "|", c[6], "|", c[7]);
  }

  // Fixed column indices: A=0 TIPO, D=3 FECHA LIC, G=6 PLAZO, H=7 TASA CORTE
  const COL_TIPO = 0;
  const COL_FECHA = 3;
  const COL_PLAZO = 6;
  const COL_TASA = 7;

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCSVLine(lines[i]);
    if (!cells.length) continue;

    const tipo = (cells[COL_TIPO] || "").replace(/"/g, "").trim().toUpperCase();
    if (tipo !== "LRMMN") continue;

    const plazo = parseFloat((cells[COL_PLAZO] || "").replace(/"/g, "").replace(",", "."));
    const tasa = parseFloat((cells[COL_TASA] || "").replace(/"/g, "").replace(",", "."));
    if (isNaN(plazo) || isNaN(tasa)) continue;

    const fecha = (cells[COL_FECHA] || "").replace(/"/g, "").trim();

    rows.push({ tipo, fecha, plazo, tasa });
  }

  console.log("LRM LRMMN rows before sort:", rows.length, "all:", JSON.stringify(rows));
  rows.sort((a, b) => {
    const [da, ma, ya] = a.fecha.split("/").map(Number);
    const [db, mb, yb] = b.fecha.split("/").map(Number);
    const dateA = new Date(ya, ma - 1, da);
    const dateB = new Date(yb, mb - 1, db);
    return dateB - dateA;
  });
  console.log("LRM rows after sort, first 5:", JSON.stringify(rows.slice(0, 5)));

  const curve = BUCKETS.map((bucket) => {
    const match = rows.find((r) => r.plazo >= bucket.min && r.plazo <= bucket.max);
    return {
      label: bucket.label,
      rate: match ? match.tasa : null,
      plazo: match ? match.plazo : null,
      fecha: match ? match.fecha : null,
    };
  });
  console.log("LRM final curve:", JSON.stringify(curve));

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
