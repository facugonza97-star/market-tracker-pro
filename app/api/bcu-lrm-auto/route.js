import pdfParse from 'pdf-parse';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const res = await fetch('https://maiorano.com.uy/files/documentos/Calendario%20Licitaciones%20BCU.pdf', {
      cache: 'no-store',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://maiorano.com.uy/',
      }
    });
    if (!res.ok) return Response.json({ error: `HTTP ${res.status}` }, { status: 500 });

    const buffer = Buffer.from(await res.arrayBuffer());
    const pdf = await pdfParse(buffer);
    const text = pdf.text;

    // Parsear filas: fecha lic | fecha integ | fecha vto | moneda | plazo | monto | hora | tasa actual | tasa anterior
    const rows = [];
    const lineRegex = /(\d{1,2}\/\d{1,2}\/\d{4})\s+(\d{1,2}\/\d{1,2}\/\d{4})\s+(\d{1,2}\/\d{1,2}\/\d{4})\s+(PESOS|UI|USD|NT\s+\S+)\s+(\d+)\s+([\d.]+)\s+([\d:,]+)\s+([\d.,]+)\s+([\d.,]+)/g;
    let match;
    while ((match = lineRegex.exec(text)) !== null) {
      rows.push({
        fechaLic: match[1],
        fechaVto: match[3],
        moneda: match[4].trim(),
        plazo: parseInt(match[5]),
        tasaActual: parseFloat(match[8].replace(',', '.')),
        tasaAnterior: parseFloat(match[9].replace(',', '.')),
      });
    }

    // Extraer tasas LRM por plazo estándar (30, 90, 180, 360)
    // Buscar los 4 plazos más cercanos a esos valores
    const plazosTarget = [30, 90, 180, 360];
    const lrm = {};
    for (const target of plazosTarget) {
      const closest = rows
        .filter(r => r.moneda === 'PESOS')
        .sort((a, b) => Math.abs(a.plazo - target) - Math.abs(b.plazo - target))[0];
      if (closest) lrm[`${target}d`] = { tasa: closest.tasaActual, plazo: closest.plazo, fechaLic: closest.fechaLic, fechaVto: closest.fechaVto };
    }

    return Response.json({ lrm, calendario: rows, rawText: text.slice(0, 500) });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
