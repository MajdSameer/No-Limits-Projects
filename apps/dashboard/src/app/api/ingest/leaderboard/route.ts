import { NextResponse, type NextRequest } from "next/server";

import { getDb } from "../../../../db/client";
import { ingestLeaderboard, type LeaderboardRow } from "../../../../db/ingest-leaderboard";
import { setSheetMonthTotal } from "../../../../db/settings";
import { notify } from "../../../../lib/notify";
import { sydneyToday } from "../../../../lib/sydney";

export const dynamic = "force-dynamic";

interface IngestBody {
  rows?: LeaderboardRow[];
  /** Optional Sydney date ("yyyy-MM-dd") the snapshot is for; defaults to today. */
  asOfDate?: string;
  /** Optional authoritative "total bookings this month" from the sheet's own
   * grand-total cell — drives the /live headline (the curated floor total). */
  monthTotal?: number;
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
  const hasRows = Array.isArray(body.rows);
  const hasTotal = typeof body.monthTotal === "number" && Number.isFinite(body.monthTotal);
  if (!hasRows && !hasTotal) {
    return NextResponse.json({ error: "expected { rows: [...] } and/or { monthTotal }" }, { status: 400 });
  }

  try {
    const result = hasRows
      ? await ingestLeaderboard(await getDb(), body.rows!, body.asOfDate)
      : {};
    // The sheet's own grand total drives the headline; store it for the current
    // Sydney month (auto-clears next month). Only touched when sent, so the
    // 5-minute roster push doesn't have to carry it.
    if (hasTotal) await setSheetMonthTotal(sydneyToday().slice(0, 7), body.monthTotal!);
    notify("bookings"); // nudge live boards to refetch right away (not just on poll)
    return NextResponse.json({ ok: true, ...result, monthTotal: hasTotal ? body.monthTotal : undefined });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
