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

// Normaliza lo guardado en la celda a un array de grupos {label, tickers}.
// Soporta el formato viejo (array plano de tickers) migrándolo a un grupo único.
function normalizeGroups(parsed) {
  if (!Array.isArray(parsed)) return [];
  if (parsed.length === 0) return [];
  // Formato viejo: array de strings
  if (typeof parsed[0] === "string") {
    return [{ label: "Mi Tracker", tickers: parsed.filter((t) => typeof t === "string") }];
  }
  // Formato nuevo: array de grupos
  return parsed
    .filter((g) => g && typeof g === "object")
    .map((g) => ({
      label: typeof g.label === "string" && g.label.trim() ? g.label : "Sin nombre",
      tickers: Array.isArray(g.tickers) ? g.tickers.filter((t) => typeof t === "string") : [],
    }));
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ groups: null }, { status: 401 });

  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: RANGE,
  });
  const rows = res.data.values || [];
  const row = rows.find((r) => r[0] === userId);
  if (!row) return Response.json({ groups: [] });

  let parsed = [];
  try {
    parsed = JSON.parse(row[1] || "[]");
  } catch {
    parsed = [];
  }
  return Response.json({ groups: normalizeGroups(parsed) });
}

export async function POST(req) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  // Acepta { groups } (nuevo) o { tickers } (compatibilidad)
  const groups = body.groups
    ? normalizeGroups(body.groups)
    : normalizeGroups(body.tickers || []);

  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: RANGE,
  });
  const rows = res.data.values || [];
  const rowIndex = rows.findIndex((r) => r[0] === userId);
  const now = new Date().toISOString();
  const value = JSON.stringify(groups);

  if (rowIndex === -1) {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: RANGE,
      valueInputOption: "RAW",
      requestBody: { values: [[userId, value, now]] },
    });
  } else {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `USER_TRACKERS!A${rowIndex + 1}:C${rowIndex + 1}`,
      valueInputOption: "RAW",
      requestBody: { values: [[userId, value, now]] },
    });
  }
  return Response.json({ ok: true });
}
