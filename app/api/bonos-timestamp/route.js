import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SHEET_ID = "1hwrHz_hsLhZVdYvh6MWxzxMOsgVo1D08Ckk0rGnHQgA";

function sheetURL() {
  return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent("Uruguay USD")}&range=G1`;
}

export async function GET() {
  try {
    const res = await fetch(sheetURL(), { cache: "no-store" });
    if (!res.ok) return NextResponse.json({ lastUpdate: null });
    const text = await res.text();
    const value = text.trim().replace(/"/g, "");
    return NextResponse.json({ lastUpdate: value || null });
  } catch {
    return NextResponse.json({ lastUpdate: null });
  }
}
