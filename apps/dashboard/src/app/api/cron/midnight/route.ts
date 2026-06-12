import { NextResponse, type NextRequest } from "next/server";

import { autoCloseOpenDays } from "../../../../db/queries/timesheet";
import { notify } from "../../../../lib/notify";
import { sydneyYesterdayRange } from "../../../../lib/sydney";

export const dynamic = "force-dynamic";

/**
 * Runs shortly after Sydney midnight (vercel.json cron): closes forgotten
 * clock-outs for the day that just ended. Idempotent — safe to re-run.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const closed = await autoCloseOpenDays(sydneyYesterdayRange());
  if (closed > 0) notify("clock");
  return NextResponse.json({ closed });
}
