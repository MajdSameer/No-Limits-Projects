import { and, asc, eq, gte, inArray, lt } from "drizzle-orm";

import { getDb, schema } from "../client";
import { deriveClock, type ClockState } from "../../lib/clock";
import { newId } from "../../lib/id";
import { SYDNEY_TZ, type InstantRange } from "../../lib/sydney";

export interface StaffDayState extends ClockState {
  staffId: string;
  name: string;
  /** A system midnight auto-close exists for this day. */
  autoClosed: boolean;
  /** Minutes late vs rostered shift start (null = no shift or not late). */
  lateMins: number | null;
}

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/** 0=Monday … 6=Sunday for the Sydney day containing the range midpoint. */
function sydneyWeekday(range: InstantRange): number {
  const midpoint = new Date((range.start.getTime() + range.end.getTime()) / 2);
  const name = new Intl.DateTimeFormat("en-US", { timeZone: SYDNEY_TZ, weekday: "long" }).format(
    midpoint,
  );
  return WEEKDAYS.indexOf(name);
}

/** Minutes since Sydney midnight for an instant. */
function sydneyMinutes(at: Date): number {
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: SYDNEY_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(at);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0) % 24;
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return h * 60 + m;
}

/** Per-staff derived clock state for the given Sydney day range. */
export async function dayStates(
  range: InstantRange,
  now: Date = new Date(),
): Promise<StaffDayState[]> {
  const db = await getDb();
  const staffRows = await db
    .select()
    .from(schema.staff)
    .where(eq(schema.staff.active, true))
    .orderBy(asc(schema.staff.name));

  const events = await db
    .select()
    .from(schema.clockEvents)
    .where(and(gte(schema.clockEvents.at, range.start), lt(schema.clockEvents.at, range.end)))
    .orderBy(asc(schema.clockEvents.at));

  const weekday = sydneyWeekday(range);
  const shiftRows = staffRows.length
    ? await db
        .select()
        .from(schema.shifts)
        .where(
          and(
            eq(schema.shifts.weekday, weekday),
            inArray(
              schema.shifts.staffId,
              staffRows.map((s) => s.id),
            ),
          ),
        )
    : [];

  return staffRows.map((s) => {
    const own = events.filter((e) => e.staffId === s.id);
    const state = deriveClock(own, now);
    const autoClosed = own.some((e) => e.kind === "out" && e.source === "system");

    const shift = shiftRows.find((sh) => sh.staffId === s.id);
    const firstIn = own.find((e) => e.kind === "in");
    let lateMins: number | null = null;
    if (shift && firstIn) {
      const [h = 0, m = 0] = shift.start.split(":").map(Number);
      const diff = sydneyMinutes(firstIn.at) - (h * 60 + m);
      lateMins = diff > 0 ? diff : null;
    }

    return { staffId: s.id, name: s.name, ...state, autoClosed, lateMins };
  });
}

/**
 * Close any day in `range` still open (last event isn't `out`): inserts a
 * system `out` one second before the range end. Idempotent. Returns count.
 */
export async function autoCloseOpenDays(range: InstantRange): Promise<number> {
  const db = await getDb();
  const events = await db
    .select()
    .from(schema.clockEvents)
    .where(and(gte(schema.clockEvents.at, range.start), lt(schema.clockEvents.at, range.end)))
    .orderBy(asc(schema.clockEvents.at));

  const byStaff = new Map<string, typeof events>();
  for (const e of events) {
    const list = byStaff.get(e.staffId) ?? [];
    list.push(e);
    byStaff.set(e.staffId, list);
  }

  let closed = 0;
  for (const [staffId, own] of byStaff) {
    if (own[own.length - 1]?.kind === "out") continue;
    await db.insert(schema.clockEvents).values({
      id: newId(),
      staffId,
      kind: "out",
      at: new Date(range.end.getTime() - 1000),
      source: "system",
      note: "Auto-closed at midnight — review",
    });
    closed++;
  }
  return closed;
}
