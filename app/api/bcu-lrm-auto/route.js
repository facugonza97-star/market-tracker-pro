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

    // Extraer texto del PDF manualmente buscando strings ASCII
    const text = buffer.toString('latin1');
    const strings = [];
    const strRegex = /\(([^\)]{2,})\)/g;
    let m;
    while ((m = strRegex.exec(text)) !== null) {
      const s = m[1].replace(/\\n/g, ' ').replace(/\\/g, '').trim();
      if (s.length > 1) strings.push(s);
    }
    const fullText = strings.join(' ');

    return Response.json({
      ok: true,
      size: buffer.byteLength,
      textSample: fullText.slice(0, 1000),
      strings: strings.slice(0, 50)
    });
  } catch (err) {
    return Response.json({ error: err.message, stack: err.stack }, { status: 500 });
  }
}
