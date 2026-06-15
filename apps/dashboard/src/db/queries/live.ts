/**
 * Read the live "Leaderboard" mirror (rep_live) for the /live board. The data
 * is whatever the spreadsheet's Apps Script last pushed (see
 * api/ingest/leaderboard). Counts reset to 0 when the snapshot isn't for today,
 * so the board self-clears at the Sydney day boundary even before the first
 * push of the new day.
 */
import { and, eq, lte } from "drizzle-orm";

import { getDb, schema } from "../client";
import { sydneyToday } from "../../lib/sydney";

export interface LiveRow {
  staffId: string;
  name: string;
  bookingsToday: number;
  goal: number | null;
  timeIn: string | null;
  timeOut: string | null;
  workingHours: string | null;
  /** true once they've clocked in and not yet out. */
  onShift: boolean;
  updatedAtISO: string | null;
}

export async function liveLeaderboard(now: Date = new Date()): Promise<LiveRow[]> {
  const db = await getDb();
  const today = sydneyToday(now);

  const rows = await db
    .select({
      staffId: schema.staff.id,
      name: schema.staff.name,
      bookingsToday: schema.repLive.bookingsToday,
      asOfDate: schema.repLive.asOfDate,
      timeIn: schema.repLive.timeIn,
      timeOut: schema.repLive.timeOut,
      workingHours: schema.repLive.workingHours,
      updatedAt: schema.repLive.updatedAt,
    })
    .from(schema.staff)
    .leftJoin(schema.repLive, eq(schema.repLive.staffId, schema.staff.id))
    .where(and(eq(schema.staff.active, true), eq(schema.staff.role, "rep")));

  // Latest effective daily goal per staff (effective_from <= today).
  const goalRows = await db
    .select({
      staffId: schema.goals.staffId,
      dailyTarget: schema.goals.dailyTarget,
      effectiveFrom: schema.goals.effectiveFrom,
    })
    .from(schema.goals)
    .where(lte(schema.goals.effectiveFrom, today));
  const goalFor = new Map<string, { target: number; from: string }>();
  for (const g of goalRows) {
    const cur = goalFor.get(g.staffId);
    if (!cur || g.effectiveFrom > cur.from) {
      goalFor.set(g.staffId, { target: g.dailyTarget, from: g.effectiveFrom });
    }
  }

  return rows
    .map((r): LiveRow => {
      const fresh = r.asOfDate === today;
      return {
        staffId: r.staffId,
        name: r.name,
        bookingsToday: fresh ? (r.bookingsToday ?? 0) : 0,
        goal: goalFor.get(r.staffId)?.target ?? null,
        timeIn: fresh ? r.timeIn : null,
        timeOut: fresh ? r.timeOut : null,
        workingHours: fresh ? r.workingHours : null,
        onShift: fresh ? Boolean(r.timeIn) && !r.timeOut : false,
        updatedAtISO: r.updatedAt ? r.updatedAt.toISOString() : null,
      };
    })
    .sort((a, b) => b.bookingsToday - a.bookingsToday || a.name.localeCompare(b.name));
}
