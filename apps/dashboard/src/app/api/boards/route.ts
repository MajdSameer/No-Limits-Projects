import { NextResponse } from "next/server";

import { dailyBoard, monthlyBoard, pipelineBoard, yesterdayBoard } from "../../../db/queries/boards";

export const dynamic = "force-dynamic";

/**
 * Public by design (the wall TV has no session): first names, counts and
 * goals ONLY — never customer or money data.
 */
export async function GET() {
  const now = new Date();
  const [daily, yesterday, monthly, pipeline] = await Promise.all([
    dailyBoard(now),
    yesterdayBoard(now),
    monthlyBoard(now),
    pipelineBoard(now),
  ]);
  return NextResponse.json(
    { daily, yesterday, monthly, pipeline, generatedAtISO: now.toISOString() },
    { headers: { "cache-control": "no-store" } },
  );
}
