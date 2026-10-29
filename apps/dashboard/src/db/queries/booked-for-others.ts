import { and, eq } from "drizzle-orm";

import { announcementsSince } from "../announcements";
import { getDb, schema } from "../client";
import { tallyBookedForOthers, type BookedForOthersRow } from "../../lib/booked-for-others";

/**
 * The /live "Booked for others" tracker: how many times each active rep has
 * booked a job for ANOTHER sales rep through the /booked form, today and this
 * month. Reads the last ~40 days of announcements (always covers the current
 * Sydney month) and tallies them against the active-rep roster.
 */
export async function bookedForOthersBoard(now: Date = new Date()): Promise<BookedForOthersRow[]> {
  const db = await getDb();
  const [items, reps] = await Promise.all([
    announcementsSince(now.getTime() - 40 * 24 * 3600 * 1000),
    db
      .select({ name: schema.staff.name })
      .from(schema.staff)
      .where(and(eq(schema.staff.active, true), eq(schema.staff.role, "rep"))),
  ]);
  return tallyBookedForOthers(items, reps.map((r) => r.name), now);
}
