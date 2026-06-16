import { NextResponse, type NextRequest } from "next/server";

import { getMonthlyGoal, setSetting } from "../../../db/settings";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * TEMP one-off admin: set the team monthly goal (a setting the sheet pushes
 * don't touch). ?key=<INGEST_SECRET>&monthlyGoal=1995. Removed once applied.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.INGEST_SECRET;
  const sp = request.nextUrl.searchParams;
  if (!secret || sp.get("key") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const goal = Number(sp.get("monthlyGoal"));
  if (Number.isFinite(goal) && goal > 0) {
    await setSetting("monthly_goal", String(Math.round(goal)));
  }
  return NextResponse.json({ monthlyGoal: await getMonthlyGoal() });
}
