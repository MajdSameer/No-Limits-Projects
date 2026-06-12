/**
 * Booking mutations, separated from server actions for direct unit testing.
 * Permission model (spec): reps create freely and edit ONLY their own
 * bookings; managers edit anything; only managers soft-delete/restore.
 */
import { eq } from "drizzle-orm";

import type { Db } from "../db/client";
import { schema } from "../db/client";
import {
  BOOKING_TYPES,
  EDITABLE_FIELDS,
  type CreateResult,
  type EditableField,
  type QuickAddInput,
  type UpdateResult,
} from "./bookings-shared";
import { newId } from "./id";

export {
  BOOKING_TYPES,
  EDITABLE_FIELDS,
  type CreateResult,
  type EditableField,
  type QuickAddInput,
  type UpdateResult,
} from "./bookings-shared";

export interface Actor {
  staffId: string;
  role: "rep" | "manager";
}

const JOB_NUMBER_RE = /^[A-Z0-9-]{3,12}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function normaliseJobNumber(raw: string): string {
  return raw.trim().toUpperCase();
}

export async function createBooking(
  db: Db,
  actor: Actor,
  input: QuickAddInput,
): Promise<CreateResult> {
  const jobNumber = normaliseJobNumber(input.jobNumber);
  if (!JOB_NUMBER_RE.test(jobNumber)) {
    return { ok: false, error: "invalid", message: "Job number must be 3–12 letters/digits." };
  }
  if (!DATE_RE.test(input.moveDate) || Number.isNaN(Date.parse(input.moveDate))) {
    return { ok: false, error: "invalid", message: "Pick a valid move date." };
  }
  if (!BOOKING_TYPES.includes(input.type)) {
    return { ok: false, error: "invalid", message: "Pick a booking type." };
  }

  const [existing] = await db
    .select({
      id: schema.bookings.id,
      enteredAt: schema.bookings.enteredAt,
      byName: schema.staff.name,
    })
    .from(schema.bookings)
    .innerJoin(schema.staff, eq(schema.bookings.salesRepId, schema.staff.id))
    .where(eq(schema.bookings.jobNumber, jobNumber));
  if (existing) {
    return {
      ok: false,
      error: "duplicate",
      existingId: existing.id,
      byName: existing.byName,
      atISO: existing.enteredAt.toISOString(),
    };
  }

  const id = newId();
  await db.insert(schema.bookings).values({
    id,
    jobNumber,
    type: input.type,
    moveDate: input.moveDate,
    customerName: input.customerName?.trim() || null,
    customerPhone: input.customerPhone?.trim() || null,
    pickup: input.pickup?.trim() || null,
    delivery: input.delivery?.trim() || null,
    value: input.value?.trim() || null,
    deposit: input.deposit?.trim() || null,
    salesRepId: actor.staffId,
    createdBy: actor.staffId,
  });
  return { ok: true, id, jobNumber };
}

export async function updateBookingRecord(
  db: Db,
  actor: Actor,
  id: string,
  patch: Partial<Record<EditableField, string | null>>,
): Promise<UpdateResult> {
  const [row] = await db.select().from(schema.bookings).where(eq(schema.bookings.id, id));
  if (!row || row.deletedAt) return { ok: false, error: "not-found" };
  if (actor.role !== "manager" && row.salesRepId !== actor.staffId) {
    return { ok: false, error: "forbidden" };
  }

  const update: Record<string, unknown> = {};
  const diff: Record<string, { from: unknown; to: unknown }> = {};
  for (const field of EDITABLE_FIELDS) {
    if (!(field in patch)) continue;
    const raw = patch[field];
    const value = typeof raw === "string" && raw.trim() === "" ? null : raw;
    const numeric = ["beds", "cubic", "men"].includes(field);
    const next = numeric && value !== null ? Number(value) : value;
    if (numeric && next !== null && Number.isNaN(next)) return { ok: false, error: "invalid" };
    const current = row[field as keyof typeof row];
    if (current !== next) {
      update[field] = next;
      diff[field] = { from: current, to: next };
    }
  }

  if (Object.keys(update).length === 0) return { ok: true, diff: {} };
  update.updatedAt = new Date();
  await db.update(schema.bookings).set(update).where(eq(schema.bookings.id, id));
  return { ok: true, diff };
}

export async function setBookingDeleted(
  db: Db,
  actor: Actor,
  id: string,
  deleted: boolean,
): Promise<UpdateResult> {
  if (actor.role !== "manager") return { ok: false, error: "forbidden" };
  const [row] = await db.select().from(schema.bookings).where(eq(schema.bookings.id, id));
  if (!row) return { ok: false, error: "not-found" };
  await db
    .update(schema.bookings)
    .set({ deletedAt: deleted ? new Date() : null, updatedAt: new Date() })
    .where(eq(schema.bookings.id, id));
  return { ok: true, diff: { deletedAt: { from: row.deletedAt, to: deleted ? "now" : null } } };
}
