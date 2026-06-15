import { and, asc, desc, eq, gte, ilike, isNull, lt, or, type SQL } from "drizzle-orm";

import { getDb, schema } from "../client";
import { sydneyDayRange, sydneyToday } from "../../lib/sydney";

/** Subcontractor (Domanic) jobs for today or the current Sydney month. */
export async function subcontractorBookings(period: "day" | "month", now: Date = new Date()) {
  const db = await getDb();
  const today = sydneyToday(now);
  const conds: SQL[] = [eq(schema.bookings.subcontractor, true), isNull(schema.bookings.deletedAt)];
  if (period === "day") {
    conds.push(eq(schema.bookings.moveDate, today));
  } else {
    const y = Number(today.slice(0, 4));
    const m = Number(today.slice(5, 7));
    const monthStart = `${today.slice(0, 7)}-01`;
    const monthEnd = `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}-01`;
    conds.push(gte(schema.bookings.moveDate, monthStart), lt(schema.bookings.moveDate, monthEnd));
  }
  return db
    .select({ booking: schema.bookings, repName: schema.staff.name })
    .from(schema.bookings)
    .innerJoin(schema.staff, eq(schema.bookings.salesRepId, schema.staff.id))
    .where(and(...conds))
    .orderBy(asc(schema.bookings.moveDate))
    .limit(200);
}

export interface BookingFilters {
  q?: string;
  filter?: "today" | "week" | "incomplete" | "mine" | "all";
  staffId?: string;
}

/** Fields counted toward "record completion" on the detail/list views. */
export const COMPLETION_FIELDS = [
  "customerName",
  "customerPhone",
  "pickup",
  "delivery",
  "value",
  "deposit",
  "leadSource",
  "beds",
  "cubic",
  "men",
] as const;

export function completion(row: Record<string, unknown>): number {
  const filled = COMPLETION_FIELDS.filter((f) => row[f] !== null && row[f] !== undefined).length;
  return Math.round((filled / COMPLETION_FIELDS.length) * 100);
}

export async function searchBookings(filters: BookingFilters) {
  const db = await getDb();
  const conds: SQL[] = [];

  if (filters.q) {
    const like = `%${filters.q.trim()}%`;
    const qCond = or(
      ilike(schema.bookings.jobNumber, like),
      ilike(schema.bookings.customerName, like),
      ilike(schema.bookings.pickup, like),
      ilike(schema.bookings.delivery, like),
    );
    if (qCond) conds.push(qCond);
  }

  if (filters.filter === "today") {
    const { start, end } = sydneyDayRange();
    conds.push(gte(schema.bookings.enteredAt, start), lt(schema.bookings.enteredAt, end));
  } else if (filters.filter === "week") {
    const { end } = sydneyDayRange();
    conds.push(gte(schema.bookings.enteredAt, new Date(end.getTime() - 7 * 864e5)));
  } else if (filters.filter === "mine" && filters.staffId) {
    conds.push(eq(schema.bookings.salesRepId, filters.staffId));
  }

  conds.push(isNull(schema.bookings.deletedAt));

  const rows = await db
    .select({
      booking: schema.bookings,
      repName: schema.staff.name,
    })
    .from(schema.bookings)
    .innerJoin(schema.staff, eq(schema.bookings.salesRepId, schema.staff.id))
    .where(and(...conds))
    .orderBy(desc(schema.bookings.enteredAt))
    .limit(200);

  const mapped = rows.map((r) => ({ ...r, completion: completion(r.booking) }));
  return filters.filter === "incomplete" ? mapped.filter((r) => r.completion < 100) : mapped;
}

export async function getBooking(id: string) {
  const db = await getDb();
  const [row] = await db
    .select({ booking: schema.bookings, repName: schema.staff.name })
    .from(schema.bookings)
    .innerJoin(schema.staff, eq(schema.bookings.salesRepId, schema.staff.id))
    .where(eq(schema.bookings.id, id));
  return row ?? null;
}

export async function bookingAudit(id: string) {
  const db = await getDb();
  return db
    .select()
    .from(schema.auditLog)
    .where(and(eq(schema.auditLog.entity, "bookings"), eq(schema.auditLog.entityId, id)))
    .orderBy(desc(schema.auditLog.at))
    .limit(10);
}
