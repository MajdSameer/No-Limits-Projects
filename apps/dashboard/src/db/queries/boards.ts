import { and, asc, eq, gte, isNull, lt, lte, sql } from "drizzle-orm";

import { getDb, schema } from "../client";
import { monthRevenueKey, monthSettingKey, PIPELINE_KEY } from "../ingest-monthly";
import { getSetting } from "../settings";
import {
  next3MonthsDateRange,
  sydneyDayRange,
  sydneyMonthRange,
  sydneyToday,
  sydneyYesterdayRange,
} from "../../lib/sydney";

export interface BoardRow {
  staffId: string;
  name: string;
  count: number;
  /** Daily target where one applies (daily/yesterday boards). */
  goal: number | null;
  gender: "f" | "m" | "x";
  team: "orange" | "blue" | null;
  /** MovePro job codes behind today's count, in sheet order (daily board only,
   * when the live sheet is pushing). The last one is the most recent booking —
   * the live board pops it up when a rep's count ticks over. */
  jobCodes?: string[];
  /** This month's NET revenue (dollars) the rep has generated — monthly board
   * only, when the Booking sheet is pushing revenue. Shown on "This month". */
  revenue?: number;
}

async function activeReps() {
  const db = await getDb();
  return db
    .select({
      id: schema.staff.id,
      name: schema.staff.name,
      gender: schema.staff.gender,
      team: schema.staff.team,
    })
    .from(schema.staff)
    .where(and(eq(schema.staff.active, true), eq(schema.staff.role, "rep")))
    .orderBy(asc(schema.staff.name));
}

/** Latest effective daily goal per staff (effective_from <= today). */
async function currentGoals(now: Date): Promise<Map<string, number>> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.goals)
    .where(lte(schema.goals.effectiveFrom, sydneyToday(now)))
    .orderBy(asc(schema.goals.effectiveFrom));
  const map = new Map<string, number>();
  for (const g of rows) map.set(g.staffId, g.dailyTarget); // later rows overwrite
  return map;
}

async function countsByEnteredAt(start: Date, end: Date): Promise<Map<string, number>> {
  const db = await getDb();
  const rows = await db
    .select({ staffId: schema.bookings.salesRepId, count: sql<number>`count(*)::int` })
    .from(schema.bookings)
    .where(
      and(
        gte(schema.bookings.enteredAt, start),
        lt(schema.bookings.enteredAt, end),
        isNull(schema.bookings.deletedAt),
      ),
    )
    .groupBy(schema.bookings.salesRepId);
  return new Map(rows.map((r) => [r.staffId, r.count]));
}

function compose(
  reps: Array<{ id: string; name: string; gender: "f" | "m" | "x"; team: "orange" | "blue" | null }>,
  counts: Map<string, number>,
  goals: Map<string, number> | null,
): BoardRow[] {
  return reps
    .map((r) => ({
      staffId: r.id,
      name: r.name,
      count: counts.get(r.id) ?? 0,
      goal: goals?.get(r.id) ?? null,
      gender: r.gender,
      team: r.team,
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/** app_settings key holding the manager's on-shift overrides for a given day. */
export function shiftOverrideKey(now: Date = new Date()): string {
  return `shift_override_${sydneyToday(now)}`;
}

/**
 * The manager's explicit "on shift today" overrides: staffId -> boolean. A rep
 * absent from this map follows the sheet's clock-in; present forces them on
 * (true) or off (false) regardless of what the sheet says. Reset each day (the
 * key is date-stamped).
 */
async function shiftOverrides(now: Date): Promise<Map<string, boolean>> {
  const raw = await getSetting(shiftOverrideKey(now), "");
  if (!raw) return new Map();
  try {
    const obj = JSON.parse(raw) as Record<string, boolean>;
    return new Map(Object.entries(obj).map(([id, v]) => [id, Boolean(v)]));
  } catch {
    return new Map();
  }
}

/** Reps the live sheet shows clocked in today (timeIn set on today's snapshot). */
async function sheetClockedIn(now: Date): Promise<Set<string>> {
  const db = await getDb();
  const today = sydneyToday(now);
  const rows = await db
    .select({
      staffId: schema.repLive.staffId,
      timeIn: schema.repLive.timeIn,
      asOf: schema.repLive.asOfDate,
    })
    .from(schema.repLive);
  const on = new Set<string>();
  for (const r of rows) {
    if (r.asOf !== today) continue;
    if (r.timeIn && String(r.timeIn).trim()) on.add(r.staffId);
  }
  return on;
}

export interface ShiftState {
  staffId: string;
  name: string;
  goal: number | null;
  gender: "f" | "m" | "x";
  /** Effective: is this rep counted as on shift right now? */
  onShift: boolean;
  /** Does the live sheet show them clocked in? */
  fromSheet: boolean;
  /** Has the manager set an explicit override (so it ignores the sheet)? */
  overridden: boolean;
}

/**
 * Per active rep: whether they're on shift today, where that came from (sheet vs
 * a manager override), and their daily goal — so /manage can show and adjust
 * who's clocked in (which drives the combined daily target).
 */
export async function shiftStates(now: Date = new Date()): Promise<ShiftState[]> {
  const [reps, goals, sheet, overrides] = await Promise.all([
    activeReps(),
    currentGoals(now),
    sheetClockedIn(now),
    shiftOverrides(now),
  ]);
  return reps.map((r) => {
    const fromSheet = sheet.has(r.id);
    const overridden = overrides.has(r.id);
    return {
      staffId: r.id,
      name: r.name,
      goal: goals.get(r.id) ?? null,
      gender: r.gender,
      onShift: overridden ? overrides.get(r.id)! : fromSheet,
      fromSheet,
      overridden,
    };
  });
}

/**
 * Today's combined daily target: the sum of the daily goals of the reps on shift
 * today, and how many that is. "On shift" = the manager's override when set,
 * otherwise the sheet's clock-in (rep_live.timeIn). Grows through the day as
 * people come on shift.
 */
export async function dailyTeamGoal(
  now: Date = new Date(),
): Promise<{ target: number; active: number }> {
  const states = await shiftStates(now);
  let target = 0;
  let active = 0;
  for (const s of states) {
    if (!s.onShift) continue;
    active += 1;
    target += s.goal ?? 0;
  }
  return { target, active };
}

/**
 * Today's booking count per rep straight from the live "Leaderboard" sheet
 * (rep_live, pushed by the Apps Script). Empty until the sheet pushes a
 * snapshot for today — callers fall back to the app's own count then.
 */
async function liveSheetCounts(
  now: Date,
): Promise<Map<string, { count: number; codes: string[] }>> {
  const db = await getDb();
  const today = sydneyToday(now);
  const rows = await db
    .select({
      staffId: schema.repLive.staffId,
      count: schema.repLive.bookingsToday,
      codes: schema.repLive.jobCodes,
      asOf: schema.repLive.asOfDate,
    })
    .from(schema.repLive);
  const m = new Map<string, { count: number; codes: string[] }>();
  for (const r of rows) {
    if (r.asOf === today) m.set(r.staffId, { count: r.count, codes: (r.codes ?? []) as string[] });
  }
  return m;
}

/**
 * Today's board per rep, with daily goals. Uses the live sheet's "bookings
 * today" count when the Leaderboard tab is pushing (the number the floor
 * watches); otherwise falls back to bookings entered in the app today. In sheet
 * mode each row also carries its MovePro job codes so the live board can pop up
 * the latest one when a rep's count ticks over.
 */
export async function dailyBoard(now: Date = new Date()): Promise<BoardRow[]> {
  const { start, end } = sydneyDayRange(now);
  const [reps, sheet, bookingCounts, goals] = await Promise.all([
    activeReps(),
    liveSheetCounts(now),
    countsByEnteredAt(start, end),
    currentGoals(now),
  ]);
  const useSheet = sheet.size > 0;
  const counts = useSheet
    ? new Map([...sheet].map(([id, v]) => [id, v.count]))
    : bookingCounts;
  const rows = compose(reps, counts, goals);
  if (useSheet) {
    for (const r of rows) {
      const codes = sheet.get(r.staffId)?.codes;
      if (codes && codes.length > 0) r.jobCodes = codes;
    }
  }
  return rows;
}

/** Bookings ENTERED yesterday (Sydney) per rep, with goals. */
export async function yesterdayBoard(now: Date = new Date()): Promise<BoardRow[]> {
  const { start, end } = sydneyYesterdayRange(now);
  const [reps, counts, goals] = await Promise.all([
    activeReps(),
    countsByEnteredAt(start, end),
    currentGoals(now),
  ]);
  return compose(reps, counts, goals);
}

/**
 * This month's per-rep count as the SHEET tallies it (every Booking row with a
 * sales person against a move date in the month), pushed via api/ingest/monthly
 * and stored in app_settings. This is the number the floor watches; it counts
 * raw rows, unlike the app's bookings table (deduped by job number). Empty
 * until the Booking sheet pushes for this month — callers fall back then.
 */
async function sheetMonthCounts(now: Date): Promise<Map<string, number>> {
  const raw = await getSetting(monthSettingKey(sydneyToday(now).slice(0, 7)), "");
  if (!raw) return new Map();
  try {
    const obj = JSON.parse(raw) as Record<string, number>;
    return new Map(Object.entries(obj).map(([id, n]) => [id, Number(n) || 0]));
  } catch {
    return new Map();
  }
}

/**
 * The whole floor's booking count for this month — the sum of EVERY ingested
 * per-rep count, including managers and anyone not on the active-rep leaderboard
 * (e.g. ex-reps like Jessica/Hermez, or Max as a manager). This is the
 * authoritative "total bookings this month" the floor watches (it matches the
 * Follow-Up sheet's grand total); the per-rep board below it lists only active
 * reps, so that list can sum to LESS than this headline. Returns 0 when the
 * sheet hasn't pushed this month — callers then fall back to the app-entered sum.
 */
export async function sheetMonthGrandTotal(now: Date = new Date()): Promise<number> {
  const counts = await sheetMonthCounts(now);
  let total = 0;
  for (const n of counts.values()) total += n;
  return total;
}

/**
 * This month's per-rep NET revenue (dollars) as the Booking sheet tallies it
 * (col AT minus the extra-charge cols AK/AL/AM/BB, which don't go to the rep),
 * pushed via api/ingest/monthly. Empty until the sheet pushes — the board then
 * simply omits the money line.
 */
async function sheetMonthRevenue(now: Date): Promise<Map<string, number>> {
  const raw = await getSetting(monthRevenueKey(sydneyToday(now).slice(0, 7)), "");
  if (!raw) return new Map();
  try {
    const obj = JSON.parse(raw) as Record<string, number>;
    return new Map(Object.entries(obj).map(([id, n]) => [id, Number(n) || 0]));
  } catch {
    return new Map();
  }
}

/**
 * This Sydney calendar month per rep. Uses the live sheet tally when the
 * Booking tab is pushing (the number the floor watches); otherwise falls back
 * to bookings entered in the app this month. When the sheet also pushes per-rep
 * revenue, each row carries its NET revenue for the "This month" money line.
 */
export async function monthlyBoard(now: Date = new Date()): Promise<BoardRow[]> {
  const { start, end } = sydneyMonthRange(now);
  const [reps, sheetCounts, appCounts, revenue] = await Promise.all([
    activeReps(),
    sheetMonthCounts(now),
    countsByEnteredAt(start, end),
    sheetMonthRevenue(now),
  ]);
  const rows = compose(reps, sheetCounts.size > 0 ? sheetCounts : appCounts, null);
  for (const r of rows) {
    const rev = revenue.get(r.staffId);
    if (rev != null) r.revenue = rev;
  }
  return rows;
}

export interface TeamMonthly {
  total: number;
  goal: number;
  pct: number;
  rows: BoardRow[];
}

/** Team progress toward the combined monthly goal. */
export async function teamMonthly(now: Date, goal: number): Promise<TeamMonthly> {
  const rows = await monthlyBoard(now);
  const total = rows.reduce((s, r) => s + r.count, 0);
  return { total, goal, pct: goal > 0 ? Math.round((total / goal) * 100) : 0, rows };
}

/** Per-rep "next 3 months" tally as the SHEET counts it (raw Booking rows with
 * a move date in the current month + next two), pushed via api/ingest/monthly.
 * Empty until the Booking tab pushes — callers fall back to the app's own
 * count then. */
async function sheetPipelineCounts(): Promise<Map<string, number>> {
  const raw = await getSetting(PIPELINE_KEY, "");
  if (!raw) return new Map();
  try {
    const obj = JSON.parse(raw) as Record<string, number>;
    return new Map(Object.entries(obj).map(([id, n]) => [id, Number(n) || 0]));
  } catch {
    return new Map();
  }
}

/**
 * Pipeline board: bookings whose MOVE DATE falls in the current month + the
 * next two (≈ the 1st of this month to the 1st three months out). Uses the live
 * sheet tally when the Booking tab is pushing (raw row count, the floor's
 * number); otherwise falls back to the app's deduped bookings in that window.
 */
export async function pipelineBoard(now: Date = new Date()): Promise<BoardRow[]> {
  const [reps, sheet] = await Promise.all([activeReps(), sheetPipelineCounts()]);
  if (sheet.size > 0) return compose(reps, sheet, null);

  const db = await getDb();
  const { from, to } = next3MonthsDateRange(now);
  const rows = await db
    .select({ staffId: schema.bookings.salesRepId, count: sql<number>`count(*)::int` })
    .from(schema.bookings)
    .where(
      and(
        gte(schema.bookings.moveDate, from),
        lt(schema.bookings.moveDate, to),
        isNull(schema.bookings.deletedAt),
      ),
    )
    .groupBy(schema.bookings.salesRepId);
  return compose(reps, new Map(rows.map((r) => [r.staffId, r.count])), null);
}
