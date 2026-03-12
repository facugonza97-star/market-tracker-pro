import { NextResponse } from "next/server";

// Mock data — the /api/v4/treasury endpoint is not available in the current FMP plan
const MOCK_TREASURY = {
  date: "2026-03-12",
  month1: 4.34,
  month2: 4.30,
  month3: 4.32,
  month6: 4.28,
  year1: 4.18,
  year2: 4.05,
  year3: 3.98,
  year5: 3.90,
  year7: 3.92,
  year10: 3.95,
  year20: 4.20,
  year30: 4.15,
};

export async function GET() {
  return NextResponse.json(MOCK_TREASURY);
}
