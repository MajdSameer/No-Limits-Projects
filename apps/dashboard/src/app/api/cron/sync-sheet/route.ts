import { NextResponse, type NextRequest } from "next/server";

import { getDb } from "../../../../db/client";
import { syncStaffFromSheet } from "../../../../db/sync-from-sheet";

export const dynamic = "force-dynamic";

/**
 * Pulls the floor roster (names, intake weights, daily goals) from the live
 * "Leaderboard" sheet into the database. Idempotent — safe to re-run. Wire a
 * schedule in vercel.json once the Google OAuth app is out of Testing mode
 * (the refresh token expires weekly until then — see TODO.md). Until then it
 * can be triggered manually with the CRON_SECRET bearer token.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await syncStaffFromSheet(await getDb());
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
