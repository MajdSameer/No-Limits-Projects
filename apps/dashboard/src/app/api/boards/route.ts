import { NextResponse } from "next/server";

import { dailyBoard, monthlyBoard, pipelineBoard, yesterdayBoard } from "../../../db/queries/boards";
import { liveAllocation } from "../../../db/queries/allocation";
import { isGameDay } from "../../../db/settings";

export const dynamic = "force-dynamic";

/**
 * Public by design (the wall TV has no session): first names, counts, goals,
 * gender/team tint and live allocation shares ONLY — never customer or money
 * data.
 */
export async function GET() {
  const now = new Date();
  const [daily, yesterday, monthly, pipeline, allocation, gameDay] = await Promise.all([
    dailyBoard(now),
    yesterdayBoard(now),
    monthlyBoard(now),
    pipelineBoard(now),
    liveAllocation(now),
    isGameDay(),
  ]);
  return NextResponse.json(
    { daily, yesterday, monthly, pipeline, allocation, gameDay, generatedAtISO: now.toISOString() },
    { headers: { "cache-control": "no-store" } },
  );
}
