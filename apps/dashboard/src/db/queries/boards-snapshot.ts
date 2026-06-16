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
const FRESH_MS = 8000;
// First compute on a cold instance: wait at most this long, then serve an empty
// board (the after() refresh keeps running to fill the cache). Bounds the cold
// path so it can never hang into a 504.
const COLD_WAIT_MS = 9000;

let cache: { at: number; data: BoardsSnapshot } | null = null;
let inflight: Promise<BoardsSnapshot> | null = null;

async function compute(): Promise<BoardsSnapshot> {
  const now = new Date();
  // Fan out — the transaction pooler handles the concurrent connections fine.
  const [daily, yesterday, monthly, pipeline, allocation, gameDay, monthlyGoal] = await Promise.all([
    dailyBoard(now),
    yesterdayBoard(now),
    monthlyBoard(now),
    pipelineBoard(now),
    liveAllocation(now),
    isGameDay(),
    getMonthlyGoal(),
  ]);
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
 * The current board snapshot, never hanging and never blanking:
 *  - Fresh cache → return instantly.
 *  - Stale cache → return it instantly and refresh via after() (which runs past
 *    the response, so the cache updates even though Vercel freezes the instance).
 *  - No cache yet → wait briefly for the first (coalesced) compute, else serve
 *    an empty board while after() keeps computing to fill the cache.
 * The client ignores empty responses, so it keeps the last good board and picks
 * up real data on the next poll once the cache is warm.
 */
export async function getBoardsSnapshot(): Promise<BoardsSnapshot> {
  if (cache && Date.now() - cache.at < FRESH_MS) return cache.data; // fresh
  const job = refresh(); // coalesced
  // Let the refresh finish past the response (Vercel keeps the function alive
  // for after()), so the cache populates even on a cold instance.
  try {
    after(() => job.catch(() => {}));
  } catch {
    /* not in a request scope (build/test) */
  }
  if (cache) return cache.data; // stale — served instantly, after() refreshes it
  // No snapshot yet: wait briefly, then serve an empty board if the cold compute
  // is slow (after() keeps it running to fill the cache). Never hangs into a 504.
  return Promise.race([
    job.catch(() => emptySnapshot()),
    new Promise<BoardsSnapshot>((resolve) => setTimeout(() => resolve(emptySnapshot()), COLD_WAIT_MS)),
  ]);
}
