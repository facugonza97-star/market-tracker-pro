import { NextResponse } from "next/server";
import https from "https";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Needed for BCU's SSL certificate
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

let cache = { data: null, timestamp: 0 };
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

function fetchPDFBuffer(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { rejectUnauthorized: false }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchPDFBuffer(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve(Buffer.concat(chunks)));
      res.on("error", reject);
    }).on("error", reject);
  });
}

function parseCalendarText(text) {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const entries = [];

  const dateRegex = /^(\d{1,2}\/\d{1,2}\/\d{4})/;

  for (const line of lines) {
    const match = line.match(dateRegex);
    if (!match) continue;

    const fecha = match[1];

    // Split by tabs
    const parts = line.split("\t").map((p) => p.trim());
    // Expected: [fecha_lic, fecha_int, fecha_venc, instrumento, plazo, monto, no_comp, horario]
    if (parts.length < 6) continue;

    const instrumento = parts[3] || "—";
    const plazo = parts[4] || "—";
    const monto = parts[5] || "—";

    // Skip header-like, footnote lines, or lines without valid instrument
    if (instrumento.includes("FECHA") || instrumento === "—" || instrumento === "-") continue;
    if (!instrumento.includes("LRM") && !instrumento.includes("NT")) continue;

    entries.push({ fecha, instrumento, plazo, monto });
  }

  return entries;
}

export async function GET() {
  const now = Date.now();
  if (cache.data && now - cache.timestamp < CACHE_TTL) {
    return NextResponse.json(cache.data);
  }

  try {
    let text = "";
    try {
      const { PDFParse } = await import("pdf-parse");
      const buffer = await fetchPDFBuffer(
        "https://www.bcu.gub.uy/Politica-Economica-y-Mercados/Calendario%20Deuda/calendario_deuda.pdf"
      );
      console.log("BCU PDF downloaded:", buffer.length, "bytes");
      const uint8 = new Uint8Array(buffer);
      const parser = new PDFParse(uint8);
      const result = await parser.getText();
      text = result.text || "";
    } catch (pdfError) {
      console.error("BCU PDF parse failed:", pdfError.message);
      // Return empty if PDF fetch/parse fails
      cache = { data: [], timestamp: now };
      return NextResponse.json([]);
    }

    const entries = parseCalendarText(text);
    console.log("BCU calendar parsed entries:", entries.length);

    // Sort by date, show all (including past week for reference)
    const sorted = entries.map((e) => {
      const [d, m, y] = e.fecha.split("/");
      return { ...e, sortDate: `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}` };
    }).sort((a, b) => a.sortDate.localeCompare(b.sortDate));

    cache = { data: sorted, timestamp: now };
    return NextResponse.json(sorted);
  } catch (error) {
    console.error("BCU calendar error:", error.message, error.stack);
    if (cache.data) return NextResponse.json(cache.data);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
