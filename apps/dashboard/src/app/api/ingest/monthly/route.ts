import { NextResponse, type NextRequest } from "next/server";

import { getDb } from "../../../../db/client";
import { ingestMonthly, ingestPipeline } from "../../../../db/ingest-monthly";

export const dynamic = "force-dynamic";
// Tiny write (two upserts). Fail fast on a cold-DB hang so the caller's retry
// kicks in quickly instead of waiting out a long timeout.
export const maxDuration = 25;

interface MonthlyBody {
  month?: string;
  counts?: Record<string, number>;
  /** Optional "next 3 months" per-rep tally (current month + next two). */
  pipeline?: Record<string, number>;
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
    const db = await getDb();
    const result = await ingestMonthly(db, body.month, body.counts);
    const pipeline =
      body.pipeline && typeof body.pipeline === "object"
        ? await ingestPipeline(db, body.pipeline)
        : undefined;
    return NextResponse.json({ ok: true, ...result, pipeline });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
