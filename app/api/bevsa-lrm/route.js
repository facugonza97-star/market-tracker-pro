export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const res = await fetch('https://web.bevsa.com.uy/Mercado/EmisionesBCUMEF/EmisionesBCU.aspx', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'es-UY,es;q=0.9',
      },
      cache: 'no-store',
    });
    const html = await res.text();
    return new Response(html, { headers: { 'Content-Type': 'text/plain' } });
  } catch (err) {
    return new Response(err.message, { status: 500 });
  }
}
