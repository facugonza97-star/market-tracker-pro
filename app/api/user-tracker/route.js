import { auth } from "@clerk/nextjs/server";
import { google } from "googleapis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SHEET_ID = "19C_ncF_8YYpHXVg8FtGaT9HtTO3e3OeWCvmv9y0L8Kg";
const RANGE = "USER_TRACKERS!A:C";

async function getSheetsClient() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  const gAuth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth: gAuth });
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ tickers: null }, { status: 401 });

  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: RANGE,
  });
  const rows = res.data.values || [];
  const row = rows.find((r) => r[0] === userId);
  if (!row) return Response.json({ tickers: null });
  return Response.json({ tickers: JSON.parse(row[1] || "[]") });
}

export async function POST(req) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { tickers } = await req.json();
  const sheets = await getSheetsClient();

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: RANGE,
  });
  const rows = res.data.values || [];
  const rowIndex = rows.findIndex((r) => r[0] === userId);
  const now = new Date().toISOString();

  if (rowIndex === -1) {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: RANGE,
      valueInputOption: "RAW",
      requestBody: { values: [[userId, JSON.stringify(tickers), now]] },
    });
  } else {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `USER_TRACKERS!A${rowIndex + 1}:C${rowIndex + 1}`,
      valueInputOption: "RAW",
      requestBody: { values: [[userId, JSON.stringify(tickers), now]] },
    });
  }
  return Response.json({ ok: true });
}
