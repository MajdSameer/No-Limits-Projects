import { NextResponse, type NextRequest } from "next/server";

import { captureGameDayResult } from "../../../../db/queries/game-day-results";

export const dynamic = "force-dynamic";

/**
 * Runs at 7pm Sydney (vercel.json cron) — captures today's Game Day result
 * if game_day mode is currently on, so it survives past midnight instead of
 * being silently overwritten once tomorrow's counts start coming in. A
 * no-op ({ captured: false }) on an ordinary (non-Game-Day) day. Idempotent
 * — captureGameDayResult upserts on date, safe to re-run.
 *
 * Fixed UTC schedule, no DST awareness (Vercel cron doesn't support it) —
 * same precedent as api/cron/midnight's own single fixed schedule: pick the
 * UTC time that's exact for AEST (standard time) and accept the wall firing
 * an hour late (8pm instead of 7pm) during AEDT (daylight, roughly Oct–Apr).
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await captureGameDayResult();
    return NextResponse.json({ captured: result !== null, result });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
