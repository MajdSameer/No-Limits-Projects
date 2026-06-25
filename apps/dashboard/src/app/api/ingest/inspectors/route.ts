import { NextResponse, type NextRequest } from "next/server";

import { getDb } from "../../../../db/client";
import { ingestInspectors, type InspectorRowIn } from "../../../../db/ingest-inspectors";
import { notify } from "../../../../lib/notify";

export const dynamic = "force-dynamic";

interface IngestBody {
  rows?: InspectorRowIn[];
  /** Optional Sydney date ("yyyy-MM-dd") the snapshot is for; defaults to today. */
  asOfDate?: string;
}

/**
 * Receives the day's site inspections pushed by the bookings sheet's Apps Script
 * and mirrors them into app_settings. Protected by the shared INGEST_SECRET
 * bearer token. Idempotent — safe to re-send (overwrites the snapshot).
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
    const result = await ingestInspectors(await getDb(), body.rows, body.asOfDate);
    notify("bookings"); // nudge live boards to refetch right away (not just on poll)
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
