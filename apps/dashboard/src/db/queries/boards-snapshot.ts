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

// Serve a cached snapshot this long without any refresh.
const FRESH_MS = 10000;
// When stale, kick off a refresh but only wait this long for it before serving
// the stale snapshot anyway — so a slow/cold DB never makes a caller hang once
// we have ANY snapshot to fall back on.
const STALE_WAIT_MS = 2500;
// First-ever compute with no snapshot: wait this long, then serve an empty
// board if the cold DB is hanging (the refresh keeps running and fills the
// cache for the next caller). Bounds every path so nothing ever 504s.
const COLD_WAIT_MS = 8000;

let cache: { at: number; data: BoardsSnapshot } | null = null;
let inflight: Promise<BoardsSnapshot> | null = null;

async function compute(): Promise<BoardsSnapshot> {
  const now = new Date();
  // Run the board queries SEQUENTIALLY, not via Promise.all. Firing them all at
  // once opens a burst of pooler connections that stalls a cold instance (the
  // source of the 504s); a timing probe proved that one-at-a-time they're
  // reliably fast (~5s total cold, ~2s warm). The cache above means this only
  // runs once every few seconds, so the slightly higher latency is invisible.
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
 * The current board snapshot. Stale-while-revalidate: once we have ANY
 * snapshot, callers get it instantly (fresh) or after a short wait at most
 * (stale → refresh races a 2.5s timeout, then the stale value is served and the
 * refresh lands in cache for the next caller). Only the very first call per
 * server instance, with no snapshot yet, waits for a full compute — and if that
 * fails (the free-tier DB hiccuping on a cold start), it returns an empty board
 * rather than throwing, so the page renders and the client poll fills it in.
 */
export async function getBoardsSnapshot(): Promise<BoardsSnapshot> {
  if (!cache) {
    // First ever on this instance: wait briefly, then serve an empty board if
    // the cold DB errors OR hangs (the refresh keeps running to fill the cache).
    return Promise.race([
      refresh().catch(() => emptySnapshot()),
      new Promise<BoardsSnapshot>((resolve) => setTimeout(() => resolve(emptySnapshot()), COLD_WAIT_MS)),
    ]);
  }
  if (Date.now() - cache.at < FRESH_MS) return cache.data; // fresh
  const stale = cache.data;
  return Promise.race([
    refresh().catch(() => stale),
    new Promise<BoardsSnapshot>((resolve) => setTimeout(() => resolve(stale), STALE_WAIT_MS)),
  ]);
}
