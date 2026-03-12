import { NextResponse } from "next/server";
import { put, list } from "@vercel/blob";
import * as XLSX from "xlsx";

const BLOB_NAME = "lrm-data.json";
const EMPTY_DATA = { curve: null, rows: [], updatedAt: null };

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

  let headerIdx = -1;
  let colTipo = -1, colFecha = -1, colPlazo = -1, colTasa = -1, colMonto = -1;

  for (let i = 0; i < Math.min(json.length, 15); i++) {
    const row = json[i];
    if (!row) continue;
    const cells = row.map((c) => String(c || "").toUpperCase().trim());
    const tipoIdx = cells.findIndex((c) => c.includes("TIPO"));
    if (tipoIdx >= 0) {
      headerIdx = i;
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
      fecha = XLSX.SSF.format("yyyy-mm-dd", fecha);
    } else {
      fecha = String(fecha || "");
    }

    const monto = parseFloat(row[colMonto]) || 0;
    rows.push({ tipo, fecha, plazo, tasa, monto });
  }

  rows.sort((a, b) => (b.fecha > a.fecha ? 1 : -1));

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

async function readFromBlob() {
  try {
    const { blobs } = await list({ prefix: BLOB_NAME });
    if (blobs.length === 0) return EMPTY_DATA;
    const res = await fetch(blobs[0].url);
    if (!res.ok) return EMPTY_DATA;
    return await res.json();
  } catch {
    return EMPTY_DATA;
  }
}

async function writeToBlob(data) {
  await put(BLOB_NAME, JSON.stringify(data), {
    access: "public",
    addRandomSuffix: false,
  });
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

    const lrmData = {
      curve: parsed.curve,
      rows: parsed.rows,
      updatedAt: new Date().toISOString(),
    };

    await writeToBlob(lrmData);
    return NextResponse.json(lrmData);
  } catch (error) {
    console.error("LRM upload error:", error);
    return NextResponse.json({ error: "Failed to parse Excel" }, { status: 500 });
  }
}

export async function GET() {
  const data = await readFromBlob();
  return NextResponse.json(data);
}
