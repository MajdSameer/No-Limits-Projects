import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";

import { getDb, schema } from "../../../../db/client";
import { setSetting } from "../../../../db/settings";
import { notify } from "../../../../lib/notify";
import { sydneyToday } from "../../../../lib/sydney";

export const dynamic = "force-dynamic";

interface Body {
  /** Staff id (name slug) to crown as today's top-revenue-job winner; "" clears it. */
  staffId?: string | null;
}

/**
 * Set (or clear) the Game Day "top revenue job" prize winner for today. Per-job
 * revenue isn't tracked, so this is normally set by a manager from /game-day;
 * this endpoint is the same write, protected by the shared INGEST_SECRET so it
 * can also be driven by automation. Stored with today's date so it auto-clears
 * tomorrow. Idempotent.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.INGEST_SECRET;
  if (!secret) return NextResponse.json({ error: "ingest not configured" }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const staffId = (body.staffId ?? "").trim();
  if (!staffId) {
    await setSetting("top_revenue_job", "");
    notify("bookings");
    return NextResponse.json({ ok: true, cleared: true });
  }

  const db = await getDb();
  const [rep] = await db.select().from(schema.staff).where(eq(schema.staff.id, staffId));
  if (!rep) return NextResponse.json({ error: `unknown staffId "${staffId}"` }, { status: 404 });

  const date = sydneyToday();
  await setSetting("top_revenue_job", JSON.stringify({ date, staffId: rep.id, name: rep.name }));
  notify("bookings");
  return NextResponse.json({ ok: true, date, staffId: rep.id, name: rep.name });
}
