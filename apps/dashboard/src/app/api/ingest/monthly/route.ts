import { NextResponse, type NextRequest } from "next/server";

import { getDb } from "../../../../db/client";
import { ingestMonthly } from "../../../../db/ingest-monthly";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface MonthlyBody {
  month?: string;
  counts?: Record<string, number>;
}

/**
 * Receives the current month's per-rep booking tally from the "Booking" tab and
 * stores it (api/ingest/monthly). Protected by the shared INGEST_SECRET bearer.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.INGEST_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "ingest not configured" }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: MonthlyBody;
  try {
    body = (await request.json()) as MonthlyBody;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  if (!body.month || typeof body.counts !== "object" || body.counts === null) {
    return NextResponse.json({ error: "expected { month, counts }" }, { status: 400 });
  }

  try {
    const result = await ingestMonthly(await getDb(), body.month, body.counts);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
