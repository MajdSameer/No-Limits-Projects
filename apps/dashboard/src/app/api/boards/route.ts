import { NextResponse } from "next/server";

import { dailyBoard, monthlyBoard, pipelineBoard, yesterdayBoard } from "../../../db/queries/boards";
import { liveAllocation } from "../../../db/queries/allocation";
import { getMonthlyGoal, isGameDay } from "../../../db/settings";

export const dynamic = "force-dynamic";

/**
 * Public by design (the wall TV has no session): first names, counts, goals,
 * gender/team tint, monthly progress and live allocation shares ONLY — never
 * customer or money data.
 */
export async function GET() {
  const now = new Date();
  const [daily, yesterday, monthly, pipeline, allocation, gameDay, goal] = await Promise.all([
    dailyBoard(now),
    yesterdayBoard(now),
    monthlyBoard(now),
    pipelineBoard(now),
    liveAllocation(now),
    isGameDay(),
    getMonthlyGoal(),
  ]);
  const monthlyTotal = monthly.reduce((s, r) => s + r.count, 0);
  return NextResponse.json(
    {
      daily,
      yesterday,
      monthly,
      pipeline,
      allocation,
      gameDay,
      monthlyGoal: goal,
      monthlyTotal,
      generatedAtISO: now.toISOString(),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
