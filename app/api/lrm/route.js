import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

// In-memory store for LRM data (persists across requests in the same server instance)
let lrmData = { curve: null, rows: [], updatedAt: null };

const BUCKETS = [
  { label: "30d", min: 0, max: 35 },
  { label: "90d", min: 80, max: 100 },
  { label: "180d", min: 160, max: 200 },
  { label: "360d", min: 340, max: 370 },
];

function parseExcel(buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  // Find header row and column indices
  let headerIdx = -1;
  let colTipo = -1, colFecha = -1, colPlazo = -1, colTasa = -1, colMonto = -1;

  for (let i = 0; i < Math.min(json.length, 15); i++) {
    const row = json[i];
    if (!row) continue;
    const cells = row.map((c) => String(c || "").toUpperCase().trim());
    const tipoIdx = cells.findIndex((c) => c.includes("TIPO"));
    if (tipoIdx >= 0) {
      headerIdx = i;
      // Map columns by header names
      for (let j = 0; j < cells.length; j++) {
        const c = cells[j];
        if (c.includes("TIPO")) colTipo = j;
        else if (c.includes("FECHA") && c.includes("LIC")) colFecha = j;
        else if (c.includes("PLAZO")) colPlazo = j;
        else if (c.includes("TASA") && c.includes("CORTE")) colTasa = j;
        else if (c.includes("MONTO") && c.includes("ACEP")) colMonto = j;
      }
      break;
    }
  }

  // Fallback to positional columns (A=0, D=3, G=6, H=7, K=10)
  if (colTipo === -1) colTipo = 0;
  if (colFecha === -1) colFecha = 3;
  if (colPlazo === -1) colPlazo = 6;
  if (colTasa === -1) colTasa = 7;
  if (colMonto === -1) colMonto = 10;

  const rows = [];
  const startRow = headerIdx >= 0 ? headerIdx + 1 : 1;

  for (let i = startRow; i < json.length; i++) {
    const row = json[i];
    if (!row || !row[colTipo]) continue;

    const tipo = String(row[colTipo]).trim().toUpperCase();
    if (!tipo.includes("LRMMN") || tipo.includes("LRMMNNC")) continue;

    const plazo = parseFloat(row[colPlazo]);
    const tasa = parseFloat(row[colTasa]);
    if (isNaN(plazo) || isNaN(tasa)) continue;

    let fecha = row[colFecha];
    if (typeof fecha === "number") {
      // Excel serial date
      fecha = XLSX.SSF.format("yyyy-mm-dd", fecha);
    } else {
      fecha = String(fecha || "");
    }

    const monto = parseFloat(row[colMonto]) || 0;

    rows.push({ tipo, fecha, plazo, tasa, monto });
  }

  // Sort by date descending
  rows.sort((a, b) => (b.fecha > a.fecha ? 1 : -1));

  // Build curve: pick most recent for each bucket
  const curve = BUCKETS.map((bucket) => {
    const match = rows.find((r) => r.plazo >= bucket.min && r.plazo <= bucket.max);
    return {
      label: bucket.label,
      rate: match ? match.tasa : null,
      plazo: match ? match.plazo : null,
      fecha: match ? match.fecha : null,
    };
  });

  return { curve, rows };
}

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = parseExcel(buffer);

    lrmData = {
      curve: parsed.curve,
      rows: parsed.rows,
      updatedAt: new Date().toISOString(),
    };

    return NextResponse.json(lrmData);
  } catch (error) {
    console.error("LRM upload error:", error);
    return NextResponse.json({ error: "Failed to parse Excel" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json(lrmData);
}
