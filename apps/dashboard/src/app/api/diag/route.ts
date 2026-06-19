import { sql } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";

import { getDb } from "../../../db/client";
import { dailyBoard, monthlyBoard, pipelineBoard, yesterdayBoard } from "../../../db/queries/boards";
import { liveAllocation } from "../../../db/queries/allocation";
import { getMonthlyGoal, isGameDay } from "../../../db/settings";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** TEMP diag: time each board building block + a raw round-trip. ?key=SECRET. */
async function timed(name: string, fn: () => Promise<unknown>) {
  const t = Date.now();
  try {
    await Promise.race([
      fn(),
      new Promise((_, rej) => setTimeout(() => rej(new Error("timeout 15s")), 15000)),
    ]);
    return { name, ms: Date.now() - t, ok: true };
  } catch (e) {
    return { name, ms: Date.now() - t, ok: false, note: String(e).slice(0, 120) };
  }
}

export async function GET(request: NextRequest) {
  const secret = process.env.INGEST_SECRET;
  if (!secret || request.nextUrl.searchParams.get("key") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const db = await getDb();
  const now = new Date();

  // Sequential, so each block's time is isolated.
  const seq = [];
  seq.push(await timed("connect+SELECT1", () => db.execute(sql`select 1 as x`)));
  seq.push(await timed("count bookings", () => db.execute(sql`select count(*)::int n from bookings`)));
  seq.push(await timed("dailyBoard", () => dailyBoard(now)));
  seq.push(await timed("yesterdayBoard", () => yesterdayBoard(now)));
  seq.push(await timed("monthlyBoard", () => monthlyBoard(now)));
  seq.push(await timed("pipelineBoard", () => pipelineBoard(now)));
  seq.push(await timed("liveAllocation", () => liveAllocation(now)));
  seq.push(await timed("isGameDay", () => isGameDay()));
  seq.push(await timed("getMonthlyGoal", () => getMonthlyGoal()));

  // All at once (what the snapshot actually does) — opens many connections.
  const tPar = Date.now();
  let parallelMs = -1;
  let parallelOk = false;
  try {
    await Promise.race([
      Promise.all([
        dailyBoard(now),
        yesterdayBoard(now),
        monthlyBoard(now),
        pipelineBoard(now),
        liveAllocation(now),
        isGameDay(),
        getMonthlyGoal(),
      ]),
      new Promise((_, rej) => setTimeout(() => rej(new Error("timeout 20s")), 20000)),
    ]);
    parallelOk = true;
  } catch {
    /* timed out */
  }
  parallelMs = Date.now() - tPar;

  return NextResponse.json(
    { sequential: seq, parallelAll: { ms: parallelMs, ok: parallelOk } },
    { headers: { "cache-control": "no-store" } },
  );
}
