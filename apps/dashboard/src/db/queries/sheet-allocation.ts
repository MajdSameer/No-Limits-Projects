/**
 * Lead allocation driven by the SHEET's clock (rep_live), for auto-allocating
 * incoming quote leads. The app's own allocator (liveAllocation) reads
 * clock_events, but reps clock in the spreadsheet now, so eligibility here comes
 * from the rep_live snapshot pushed by the Leaderboard Apps Script. Reuses the
 * same pure allocate() fairness model.
 */
import { and, asc, eq, gte, lt } from "drizzle-orm";

import { getDb, schema } from "../client";
import { allocate, type AllocCandidate, type ClockStatus } from "../../lib/lead-allocation";
import { sydneyDayRange, sydneyToday } from "../../lib/sydney";

/** Sheet clock strings ("06:41" or "7.35") → decimal hours. */
function parseHours(s: string | null): number {
  if (!s) return 0;
  const t = s.trim();
  if (t.includes(":")) {
    const [h, m] = t.split(":").map(Number);
    return (h || 0) + (m || 0) / 60;
  }
  const n = Number(t);
  return Number.isFinite(n) ? n : 0;
}

function sheetStatus(r: {
  timeIn: string | null;
  breakStart: string | null;
  breakEnd: string | null;
  timeOut: string | null;
}): ClockStatus {
  if (r.timeOut) return "done";
  if (r.breakStart && !r.breakEnd) return "break";
  if (r.timeIn) return "on";
  return "off";
}

/** Who should receive the next lead, per the sheet's live clock. */
export async function nextRepFromSheet(now: Date = new Date()): Promise<string | null> {
  const db = await getDb();
  const today = sydneyToday(now);
  const { start, end } = sydneyDayRange(now);

  const reps = await db
    .select()
    .from(schema.staff)
    .where(and(eq(schema.staff.active, true), eq(schema.staff.role, "rep")))
    .orderBy(asc(schema.staff.name));

  const [liveRows, leadRows] = await Promise.all([
    db.select().from(schema.repLive),
    db
      .select({ staffId: schema.leads.staffId })
      .from(schema.leads)
      .where(and(gte(schema.leads.at, start), lt(schema.leads.at, end))),
  ]);

  const liveByStaff = new Map(liveRows.filter((r) => r.asOfDate === today).map((r) => [r.staffId, r]));
  const leadsByStaff = new Map<string, number>();
  for (const l of leadRows) leadsByStaff.set(l.staffId, (leadsByStaff.get(l.staffId) ?? 0) + 1);

  const candidates: AllocCandidate[] = reps.map((r) => {
    const live = liveByStaff.get(r.id);
    return {
      staffId: r.id,
      name: r.name,
      weight: Number(r.intakeWeight),
      status: live ? sheetStatus(live) : "off",
      workedHours: parseHours(live?.workingHours ?? null),
      leadsToday: leadsByStaff.get(r.id) ?? 0,
    };
  });

  return allocate(candidates).nextUp;
}
