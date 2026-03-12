import { NextResponse } from "next/server";
import { put, list } from "@vercel/blob";

export const runtime = "nodejs";

const BLOB_NAME = "bcu-calendar.json";

async function readFromBlob() {
  try {
    const { blobs } = await list();
    console.log("BCU calendar list blobs:", blobs.map(b => b.pathname));
    const match = blobs.find((b) => b.pathname === BLOB_NAME || b.pathname.endsWith("/" + BLOB_NAME));
    if (!match) return [];
    const res = await fetch(match.url);
    if (!res.ok) return [];
    return await res.json();
  } catch (error) {
    console.error("BCU calendar read error:", error.message);
    return [];
  }
}

async function writeToBlob(data) {
  try {
    await put(BLOB_NAME, JSON.stringify(data), {
      access: "public",
      addRandomSuffix: false,
    });
  } catch (error) {
    console.error("BCU calendar write error:", error.message);
  }
}

export async function GET() {
  const data = await readFromBlob();
  return NextResponse.json(data);
}

export async function POST(request) {
  try {
    const data = await request.json();
    if (!Array.isArray(data)) {
      return NextResponse.json({ error: "Expected array" }, { status: 400 });
    }
    await writeToBlob(data);
    return NextResponse.json(data);
  } catch (error) {
    console.error("BCU calendar POST error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
