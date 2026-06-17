import { NextResponse, type NextRequest } from "next/server";

import { getDb } from "../../../../db/client";
import { ingestLeaderboard, type LeaderboardRow } from "../../../../db/ingest-leaderboard";
import { notify } from "../../../../lib/notify";

export const dynamic = "force-dynamic";

interface IngestBody {
  rows?: LeaderboardRow[];
  /** Optional Sydney date ("yyyy-MM-dd") the snapshot is for; defaults to today. */
  asOfDate?: string;
}

/**
 * Receives a "Leaderboard" snapshot pushed by the spreadsheet's Apps Script
 * and mirrors it into the database (rep_live + roster/goals). Protected by the
 * shared INGEST_SECRET bearer token. Idempotent — safe to re-send.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.INGEST_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "ingest not configured" }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: IngestBody;
  try {
    body = (await request.json()) as IngestBody;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  if (!Array.isArray(body.rows)) {
    return NextResponse.json({ error: "expected { rows: [...] }" }, { status: 400 });
  }

  try {
    const result = await ingestLeaderboard(await getDb(), body.rows, body.asOfDate);
    notify("bookings"); // nudge live boards to refetch right away (not just on poll)
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
