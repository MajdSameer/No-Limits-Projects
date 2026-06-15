import { NextResponse, type NextRequest } from "next/server";

import { getDb } from "../../../../db/client";
import { ingestRoster, type RosterRow } from "../../../../db/ingest-roster";

export const dynamic = "force-dynamic";

interface RosterBody {
  rows?: RosterRow[];
  /** Optional shift times applied to every worked day (default 08:00–17:00). */
  start?: string;
  end?: string;
}

/**
 * Receives the weekly roster pushed from the "Live Roster" tab and mirrors it
 * into the shifts table. Protected by the shared INGEST_SECRET bearer token.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.INGEST_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "ingest not configured" }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: RosterBody;
  try {
    body = (await request.json()) as RosterBody;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  if (!Array.isArray(body.rows)) {
    return NextResponse.json({ error: "expected { rows: [...] }" }, { status: 400 });
  }

  try {
    const result = await ingestRoster(await getDb(), body.rows, {
      start: body.start,
      end: body.end,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
