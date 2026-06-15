import { NextResponse, type NextRequest } from "next/server";

import { getDb } from "../../../../db/client";
import { ingestBookings, type BookingRow } from "../../../../db/ingest-bookings";

export const dynamic = "force-dynamic";

interface BookingsBody {
  rows?: BookingRow[];
}

/**
 * Receives a batch of bookings pushed from the "Booking" tab and upserts them
 * (keyed on job number). Protected by the shared INGEST_SECRET bearer token.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.INGEST_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "ingest not configured" }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: BookingsBody;
  try {
    body = (await request.json()) as BookingsBody;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  if (!Array.isArray(body.rows)) {
    return NextResponse.json({ error: "expected { rows: [...] }" }, { status: 400 });
  }

  try {
    const result = await ingestBookings(await getDb(), body.rows);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
