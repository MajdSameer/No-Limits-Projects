import { and, asc, eq, gte, lt } from "drizzle-orm";

import { getDb, schema } from "../client";
import { allocate, type AllocCandidate, type Allocation } from "../../lib/lead-allocation";
import { deriveClock } from "../../lib/clock";
import { sydneyDayRange } from "../../lib/sydney";

/** Current live lead allocation among clocked-in, not-on-break reps. */
export async function liveAllocation(now: Date = new Date()): Promise<Allocation> {
  const db = await getDb();
  const { start, end } = sydneyDayRange(now);

  const reps = await db
    .select()
    .from(schema.staff)
    .where(and(eq(schema.staff.active, true), eq(schema.staff.role, "rep")))
    .orderBy(asc(schema.staff.name));

  const [clockRows, leadRows] = await Promise.all([
    db
      .select()
      .from(schema.clockEvents)
      .where(and(gte(schema.clockEvents.at, start), lt(schema.clockEvents.at, end)))
      .orderBy(asc(schema.clockEvents.at)),
    db
      .select()
      .from(schema.leads)
      .where(and(gte(schema.leads.at, start), lt(schema.leads.at, end))),
  ]);

  const leadsByStaff = new Map<string, number>();
  for (const l of leadRows) leadsByStaff.set(l.staffId, (leadsByStaff.get(l.staffId) ?? 0) + 1);

  const candidates: AllocCandidate[] = reps.map((r) => {
    const clock = deriveClock(
      clockRows.filter((e) => e.staffId === r.id),
      now,
    );
    return {
      staffId: r.id,
      name: r.name,
      weight: Number(r.intakeWeight),
      status: clock.status,
      workedHours: clock.workedMs / 36e5,
      leadsToday: leadsByStaff.get(r.id) ?? 0,
    };
  });

  return allocate(candidates);
}

export interface AllocationViewRow {
  staffId: string;
  name: string;
  gender: "f" | "m" | "x";
  weight: number;
  status: "off" | "on" | "break" | "done";
  sharePct: number | null;
  leadsToday: number;
}

export interface AllocationView {
  reps: AllocationViewRow[];
  nextUp: string | null;
  totalLeadsToday: number;
  eligibleCount: number;
}

/** Full allocation board: every active rep + the live computed shares. */
export async function allocationView(now: Date = new Date()): Promise<AllocationView> {
  const db = await getDb();
  const { start, end } = sydneyDayRange(now);

  const reps = await db
    .select()
    .from(schema.staff)
    .where(and(eq(schema.staff.active, true), eq(schema.staff.role, "rep")))
    .orderBy(asc(schema.staff.name));

  const [clockRows, leadRows] = await Promise.all([
    db
      .select()
      .from(schema.clockEvents)
      .where(and(gte(schema.clockEvents.at, start), lt(schema.clockEvents.at, end)))
      .orderBy(asc(schema.clockEvents.at)),
    db.select().from(schema.leads).where(and(gte(schema.leads.at, start), lt(schema.leads.at, end))),
  ]);

  const leadsByStaff = new Map<string, number>();
  for (const l of leadRows) leadsByStaff.set(l.staffId, (leadsByStaff.get(l.staffId) ?? 0) + 1);

  const meta = new Map(
    reps.map((r) => {
      const clock = deriveClock(
        clockRows.filter((e) => e.staffId === r.id),
        now,
      );
      return [
        r.id,
        {
          gender: r.gender,
          weight: Number(r.intakeWeight),
          status: clock.status,
          workedHours: clock.workedMs / 36e5,
          leadsToday: leadsByStaff.get(r.id) ?? 0,
        },
      ] as const;
    }),
  );

  const alloc = allocate(
    reps.map((r) => {
      const m = meta.get(r.id)!;
      return {
        staffId: r.id,
        name: r.name,
        weight: m.weight,
        status: m.status,
        workedHours: m.workedHours,
        leadsToday: m.leadsToday,
      };
    }),
  );
  const shareByStaff = new Map(alloc.eligible.map((e) => [e.staffId, e.sharePct]));

  return {
    reps: reps.map((r) => {
      const m = meta.get(r.id)!;
      return {
        staffId: r.id,
        name: r.name,
        gender: m.gender,
        weight: m.weight,
        status: m.status,
        sharePct: shareByStaff.get(r.id) ?? null,
        leadsToday: m.leadsToday,
      };
    }),
    nextUp: alloc.nextUp,
    totalLeadsToday: alloc.totalLeadsToday,
    eligibleCount: alloc.eligible.length,
  };
}
