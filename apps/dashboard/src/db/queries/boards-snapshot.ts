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

const TTL_MS = 4000;

let cache: { at: number; data: BoardsSnapshot } | null = null;
let inflight: Promise<BoardsSnapshot> | null = null;

async function compute(): Promise<BoardsSnapshot> {
  const now = new Date();
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

/**
 * The current board snapshot, served from a short-lived cache. Concurrent
 * callers within a TTL window share one computation; this is the only thing
 * that should touch the board queries on a request path.
 */
export async function getBoardsSnapshot(): Promise<BoardsSnapshot> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.data;
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
