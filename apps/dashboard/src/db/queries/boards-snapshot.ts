/**
 * Cached, request-coalesced board snapshot shared by /api/boards and /tv.
 *
 * The board is computed from ~17 DB queries and is polled every few seconds by
 * every open wall display. Hitting the database on every request opens a burst
 * of pooler connections that the small Supabase instance can't absorb, so the
 * endpoint stalls. This wrapper computes the snapshot at most once every few
 * seconds (TTL cache) and folds any concurrent requests into a single in-flight
 * computation — so N polling tabs cause ~one board query per TTL window, not N.
 *
 * The cache is per server instance and intentionally short: pushes update the
 * underlying data continuously and a few seconds of staleness on a wall board
 * is invisible.
 */
import { after } from "next/server";

import { dailyBoard, monthlyBoard, pipelineBoard, yesterdayBoard, type BoardRow } from "./boards";
import { liveAllocation } from "./allocation";
import { getMonthlyGoal, isGameDay } from "../settings";

interface AllocSlot {
  staffId: string;
  name: string;
  sharePct: number;
  leadsToday: number;
}

export interface BoardsSnapshot {
  daily: BoardRow[];
  yesterday: BoardRow[];
  monthly: BoardRow[];
  pipeline: BoardRow[];
  allocation: { eligible: AllocSlot[]; nextUp: string | null; totalLeadsToday: number };
  gameDay: boolean;
  monthlyGoal: number;
  monthlyTotal: number;
  generatedAtISO: string;
}

// Serve a cached snapshot this long without recomputing. Kept short so a new
// booking shows on the board (and triggers the gong) within ~15s of being
// entered — pooler handles the extra recomputes fine.
const FRESH_MS = 4000;

let cache: { at: number; data: BoardsSnapshot } | null = null;
let inflight: Promise<BoardsSnapshot> | null = null;

async function compute(): Promise<BoardsSnapshot> {
  const now = new Date();
  // Run the boards ONE AT A TIME, not Promise.all. Fanning out fires ~17
  // queries at once, which opens too many Supabase-pooler connections
  // simultaneously and stalls (a timing probe: sequential ~5s total, parallel
  // timed out >20s). Each board internally still parallelises its own few
  // queries — that's fine; it's the all-at-once burst that stalls.
  const daily = await dailyBoard(now);
  const yesterday = await yesterdayBoard(now);
  const monthly = await monthlyBoard(now);
  const pipeline = await pipelineBoard(now);
  const allocation = await liveAllocation(now);
  const gameDay = await isGameDay();
  const monthlyGoal = await getMonthlyGoal();
  const monthlyTotal = monthly.reduce((s, r) => s + r.count, 0);
  return {
    daily,
    yesterday,
    monthly,
    pipeline,
    allocation,
    gameDay,
    monthlyGoal,
    monthlyTotal,
    generatedAtISO: now.toISOString(),
  };
}

/** An empty board to fall back on so a DB hiccup degrades instead of 500ing. */
function emptySnapshot(): BoardsSnapshot {
  return {
    daily: [],
    yesterday: [],
    monthly: [],
    pipeline: [],
    allocation: { eligible: [], nextUp: null, totalLeadsToday: 0 },
    gameDay: false,
    monthlyGoal: 1500,
    monthlyTotal: 0,
    generatedAtISO: new Date().toISOString(),
  };
}

/** Compute into the cache, coalescing concurrent callers onto one run. */
function refresh(): Promise<BoardsSnapshot> {
  if (inflight) return inflight;
  inflight = compute()
    .then((data) => {
      cache = { at: Date.now(), data };
      return data;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/**
 * The current board snapshot. Within the short fresh window the cache is served
 * instantly; otherwise we AWAIT a fresh compute (coalesced, so concurrent
 * callers share one) so every caller gets CURRENT data — that's what makes a new
 * booking appear (and gong) within ~15s, instead of bouncing around stale
 * per-instance caches. The pooler makes the recompute reliable (~2s warm); on a
 * DB error we fall back to the last good snapshot, or an empty board, rather
 * than throwing. The route's maxDuration caps any pathological hang.
 */
export async function getBoardsSnapshot(): Promise<BoardsSnapshot> {
  if (cache && Date.now() - cache.at < FRESH_MS) return cache.data; // fresh
  const job = refresh(); // coalesced — current data
  // Keep the compute alive past the response (Vercel after()) so the cache fills
  // even when the soft cap below fires on a slow cold instance.
  try {
    after(() => job.catch(() => {}));
  } catch {
    /* not in a request scope (build/test) */
  }
  try {
    return await Promise.race([
      job,
      new Promise<BoardsSnapshot>((_, reject) => setTimeout(() => reject(new Error("slow")), 12000)),
    ]);
  } catch {
    // Compute errored or is taking too long: serve the last good snapshot (or
    // empty) so we never hang into a 504; after() finishes filling the cache.
    return cache?.data ?? emptySnapshot();
  }
}
