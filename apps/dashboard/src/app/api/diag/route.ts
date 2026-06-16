import { sql } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";

import { getDb } from "../../../db/client";
import { dailyBoard, monthlyBoard, pipelineBoard, yesterdayBoard } from "../../../db/queries/boards";
import { liveAllocation } from "../../../db/queries/allocation";
import { getMonthlyGoal, getSetting, isGameDay } from "../../../db/settings";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * TEMP diagnostic: times each /api/boards building block in isolation (each
 * raced against an 8s cap) to find which query stalls. Guarded by INGEST_SECRET
 * via ?key=. Returns durations only — no PII. Remove once the board is healthy.
 */
async function timed(name: string, fn: () => Promise<unknown>) {
  const t = Date.now();
  try {
    const out = await Promise.race([
      fn(),
      new Promise((_, rej) => setTimeout(() => rej(new Error("timeout 8s")), 8000)),
    ]);
    const note = Array.isArray(out) ? `rows=${out.length}` : undefined;
    return { name, ms: Date.now() - t, ok: true, note };
  } catch (e) {
    return { name, ms: Date.now() - t, ok: false, note: String(e).slice(0, 160) };
  }
}

export async function GET(request: NextRequest) {
  const secret = process.env.INGEST_SECRET;
  if (!secret || request.nextUrl.searchParams.get("key") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const db = await getDb();
  const now = new Date();

  const steps = [];
  steps.push(await timed("count bookings", () => db.execute(sql`select count(*)::int as n from bookings`)));
  steps.push(await timed("count clock_events", () => db.execute(sql`select count(*)::int as n from clock_events`)));
  steps.push(await timed("count leads", () => db.execute(sql`select count(*)::int as n from leads`)));
  steps.push(await timed("count lead_inbox", () => db.execute(sql`select count(*)::int as n from lead_inbox`)));
  steps.push(await timed("getSetting rep_month", () => getSetting(`rep_month:${now.toISOString().slice(0, 7)}`, "")));
  steps.push(await timed("isGameDay", () => isGameDay()));
  steps.push(await timed("getMonthlyGoal", () => getMonthlyGoal()));
  steps.push(await timed("dailyBoard", () => dailyBoard(now)));
  steps.push(await timed("yesterdayBoard", () => yesterdayBoard(now)));
  steps.push(await timed("monthlyBoard", () => monthlyBoard(now)));
  steps.push(await timed("pipelineBoard", () => pipelineBoard(now)));
  steps.push(await timed("liveAllocation", () => liveAllocation(now)));

  return NextResponse.json({ steps }, { headers: { "cache-control": "no-store" } });
}
