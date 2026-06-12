"use server";

import { revalidatePath } from "next/cache";

import { logAudit } from "../../db/audit";
import { getDb } from "../../db/client";
import { createBooking, setBookingDeleted, updateBookingRecord } from "../../lib/bookings-core";
import type {
  CreateResult,
  EditableField,
  QuickAddInput,
  UpdateResult,
} from "../../lib/bookings-shared";
import { notify } from "../../lib/notify";
import { requireSession } from "../../lib/session";

export async function quickAdd(input: QuickAddInput): Promise<CreateResult> {
  const session = await requireSession();
  const db = await getDb();
  const result = await createBooking(db, session, input);
  if (result.ok) {
    await logAudit({
      staffId: session.staffId,
      action: "booking.create",
      entity: "bookings",
      entityId: result.id,
      diff: { jobNumber: result.jobNumber, type: input.type, moveDate: input.moveDate },
    });
    notify("bookings");
    revalidatePath("/", "layout");
  }
  return result;
}

export async function updateBooking(
  id: string,
  patch: Partial<Record<EditableField, string | null>>,
): Promise<UpdateResult> {
  const session = await requireSession();
  const db = await getDb();
  const result = await updateBookingRecord(db, session, id, patch);
  if (result.ok && Object.keys(result.diff).length > 0) {
    await logAudit({
      staffId: session.staffId,
      action: "booking.update",
      entity: "bookings",
      entityId: id,
      diff: result.diff,
    });
    notify("bookings");
    revalidatePath("/", "layout");
  }
  return result;
}

export async function setDeleted(id: string, deleted: boolean): Promise<UpdateResult> {
  const session = await requireSession();
  const db = await getDb();
  const result = await setBookingDeleted(db, session, id, deleted);
  if (result.ok) {
    await logAudit({
      staffId: session.staffId,
      action: deleted ? "booking.delete" : "booking.restore",
      entity: "bookings",
      entityId: id,
    });
    notify("bookings");
    revalidatePath("/", "layout");
  }
  return result;
}
