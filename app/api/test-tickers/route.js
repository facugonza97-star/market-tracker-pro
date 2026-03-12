import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
const API_KEY = process.env.FMP_API_KEY;
const STABLE = "https://financialmodelingprep.com/stable";

async function fetchEndpoint(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return { url, status: res.status, error: await res.text().then(t => t.slice(0, 200)) };
    const data = await res.json();
    return { url, status: res.status, count: Array.isArray(data) ? data.length : 1, sample: Array.isArray(data) ? data.slice(0, 5) : data };
  } catch (e) {
    return { url, error: e.message };
  }
}

async function searchInList(url, keywords) {
  try {
    const res = await fetch(url);
    if (!res.ok) return { url, status: res.status, matches: [] };
    const data = await res.json();
    if (!Array.isArray(data)) return { url, notArray: true };
    const matches = data.filter(item => {
      const str = JSON.stringify(item).toUpperCase();
      return keywords.some(kw => str.includes(kw.toUpperCase()));
    });
    return { url, totalItems: data.length, matches: matches.slice(0, 10) };
  } catch (e) {
    return { url, error: e.message };
  }
}

export async function GET() {
  const keywords = ["WTI", "CRUDE", "CL=F", "CLUSD", "DXY", "DOLLAR INDEX", "DX=F", "DXUSD"];

  const [commodity, quotesCommodity, indexList] = await Promise.all([
    fetchEndpoint(`${STABLE}/commodity?apikey=${API_KEY}`),
    searchInList(`${STABLE}/quotes/commodity?apikey=${API_KEY}`, keywords),
    searchInList(`${STABLE}/index/list?apikey=${API_KEY}`, keywords),
  ]);

  return NextResponse.json({ commodity, quotesCommodity, indexList });
}
