import { NextResponse, type NextRequest } from "next/server";

import { getDb } from "../../../../db/client";
import {
  ingestSubcontractors,
  type SubcontractorRowIn,
} from "../../../../db/ingest-subcontractors";
import { notify } from "../../../../lib/notify";

export const dynamic = "force-dynamic";

interface IngestBody {
  rows?: SubcontractorRowIn[];
  /** Optional Sydney date ("yyyy-MM-dd") the snapshot is for; defaults to today. */
  asOfDate?: string;
}

/**
 * Receives the subcontractor's daily/monthly tally pushed by the Follow-Up
 * sheet's Apps Script and mirrors it into app_settings. Protected by the shared
 * INGEST_SECRET bearer token. Idempotent — safe to re-send (overwrites the
 * snapshot).
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
    const result = await ingestSubcontractors(await getDb(), body.rows, body.asOfDate);
    notify("bookings"); // nudge live boards to refetch right away (not just on poll)
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
