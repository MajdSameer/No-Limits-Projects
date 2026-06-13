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

/** Bookings ENTERED this Sydney calendar month per rep. */
export async function monthlyBoard(now: Date = new Date()): Promise<BoardRow[]> {
  const { start, end } = sydneyMonthRange(now);
  const [reps, counts] = await Promise.all([activeReps(), countsByEnteredAt(start, end)]);
  return compose(reps, counts, null);
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
