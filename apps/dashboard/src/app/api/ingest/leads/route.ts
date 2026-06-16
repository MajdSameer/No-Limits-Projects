import { NextResponse, type NextRequest } from "next/server";

import { getDb } from "../../../../db/client";
import { ingestLeads, type LeadRow } from "../../../../db/ingest-leads";

export const dynamic = "force-dynamic";
// Batch is allocated in memory off one snapshot, but allow headroom for a
// large first push and a cold DB connection.
export const maxDuration = 60;

interface LeadsBody {
  rows?: LeadRow[];
}

/**
 * Receives incoming quote leads pushed from the "Quote Leads" sheet, mirrors
 * them into the inbox and auto-allocates each to the next-up rep. Protected by
 * the shared INGEST_SECRET bearer token.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.INGEST_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "ingest not configured" }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: LeadsBody;
  try {
    body = (await request.json()) as LeadsBody;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  if (!Array.isArray(body.rows)) {
    return NextResponse.json({ error: "expected { rows: [...] }" }, { status: 400 });
  }

  try {
    const result = await ingestLeads(await getDb(), body.rows);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
