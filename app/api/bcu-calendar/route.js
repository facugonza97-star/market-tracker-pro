import { NextResponse } from "next/server";
import https from "https";

export const dynamic = "force-dynamic";

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
    const { PDFParse } = await import("pdf-parse");

    const buffer = await fetchPDFBuffer(
      "https://www.bcu.gub.uy/Politica-Economica-y-Mercados/Calendario%20Deuda/calendario_deuda.pdf"
    );
    const uint8 = new Uint8Array(buffer);
    const parser = new PDFParse(uint8);
    const result = await parser.getText();
    const text = result.text || "";

    const entries = parseCalendarText(text);

    // Filter only future dates
    const today = new Date().toISOString().split("T")[0];
    const filtered = entries.map((e) => {
      const [d, m, y] = e.fecha.split("/");
      return { ...e, sortDate: `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}` };
    }).filter((e) => e.sortDate >= today)
      .sort((a, b) => a.sortDate.localeCompare(b.sortDate));

    cache = { data: filtered, timestamp: now };
    return NextResponse.json(filtered);
  } catch (error) {
    console.error("BCU calendar error:", error);
    if (cache.data) return NextResponse.json(cache.data);
    return NextResponse.json({ error: "Failed to fetch BCU calendar" }, { status: 500 });
  }
}
