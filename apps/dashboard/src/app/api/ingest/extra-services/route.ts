import { NextResponse, type NextRequest } from "next/server";

import { getDb } from "../../../../db/client";
import { ingestExtraServices, type ExtraServicesIn } from "../../../../db/ingest-extra-services";
import { notify } from "../../../../lib/notify";

export const dynamic = "force-dynamic";

interface IngestBody extends ExtraServicesIn {
  /** Optional Sydney date ("yyyy-MM-dd") the snapshot is for; defaults to today. */
  asOfDate?: string;
}

/** Receives the extra-services booker's daily jobs + monthly count from the Follow-Up
 * sheet's Apps Script. Protected by the shared INGEST_SECRET bearer token; idempotent. */
export async function POST(request: NextRequest) {
  const secret = process.env.INGEST_SECRET;
  if (!secret) return NextResponse.json({ error: "ingest not configured" }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: IngestBody;
  try {
    body = (await request.json()) as IngestBody;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  try {
    const result = await ingestExtraServices(await getDb(), body, body.asOfDate);
    notify("bookings");
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
