export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const res = await fetch('https://web.bevsa.com.uy/Mercado/EmisionesBCUMEF/EmisionesBCU.aspx', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-UY,es;q=0.9,en;q=0.8',
        'Referer': 'https://web.bevsa.com.uy/',
      },
      cache: 'no-store',
    });

    if (!res.ok) return Response.json({ error: `HTTP ${res.status}` }, { status: 500 });

    const html = await res.text();

    // Parsear la tabla de resultados
    const rows = [];
    const tableRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let tableMatch;

    while ((tableMatch = tableRegex.exec(html)) !== null) {
      const rowHtml = tableMatch[1];
      const cells = [];
      let cellMatch;
      while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
        const text = cellMatch[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
        cells.push(text);
      }
      if (cells.length >= 4) rows.push(cells);
    }

    return Response.json({ rows, total: rows.length });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
