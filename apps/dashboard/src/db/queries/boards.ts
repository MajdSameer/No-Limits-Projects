import { and, asc, eq, gte, isNull, lt, lte, sql } from "drizzle-orm";

import { getDb, schema } from "../client";
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

/** Bookings ENTERED today (Sydney) per rep, with daily goals. */
export async function dailyBoard(now: Date = new Date()): Promise<BoardRow[]> {
  const { start, end } = sydneyDayRange(now);
  const [reps, counts, goals] = await Promise.all([
    activeReps(),
    countsByEnteredAt(start, end),
    currentGoals(now),
  ]);
  return compose(reps, counts, goals);
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
 * Real monthly tally carried over from the team's existing tracking, used as
 * a starting baseline for the month it applies to. App-entered bookings are
 * added on top. (Manager's snapshot, 13 Jun 2026 — total 961.)
 */
export const MONTHLY_BASELINE: { month: string; counts: Record<string, number> } = {
  month: "2026-06",
  counts: {
    nisreen: 104,
    francis: 100,
    jenifer: 98,
    randee: 91,
    harry: 87,
    hadeel: 71,
    ann: 63,
    issac: 60,
    andy: 58,
    max: 56,
    mariam: 49,
    hanna: 46,
    emilia: 37,
    jessica: 31,
    hermez: 10,
  },
};

function baselineFor(now: Date): Record<string, number> {
  return MONTHLY_BASELINE.month === sydneyToday(now).slice(0, 7)
    ? MONTHLY_BASELINE.counts
    : {};
}

/** Bookings ENTERED this Sydney calendar month per rep, plus the baseline. */
export async function monthlyBoard(now: Date = new Date()): Promise<BoardRow[]> {
  const { start, end } = sydneyMonthRange(now);
  const [reps, counts] = await Promise.all([activeReps(), countsByEnteredAt(start, end)]);
  const base = baselineFor(now);
  const withBase = new Map(counts);
  for (const [id, n] of Object.entries(base)) withBase.set(id, (withBase.get(id) ?? 0) + n);
  return compose(reps, withBase, null);
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

/** Pipeline: bookings whose MOVE DATE is within the next 3 months. */
export async function pipelineBoard(now: Date = new Date()): Promise<BoardRow[]> {
  const db = await getDb();
  const { from, to } = next3MonthsDateRange(now);
  const rows = await db
    .select({ staffId: schema.bookings.salesRepId, count: sql<number>`count(*)::int` })
    .from(schema.bookings)
    .where(
      and(
        gte(schema.bookings.moveDate, from),
        lte(schema.bookings.moveDate, to),
        isNull(schema.bookings.deletedAt),
      ),
    )
    .groupBy(schema.bookings.salesRepId);
  const reps = await activeReps();
  return compose(reps, new Map(rows.map((r) => [r.staffId, r.count])), null);
}
