"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";

import { logAudit } from "../../db/audit";
import { getDb, schema } from "../../db/client";
import { newId } from "../../lib/id";
import { notify } from "../../lib/notify";
import { requireManager } from "../../lib/session";

export interface ActionState {
  error?: string;
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function setShift(
  staffId: string,
  weekday: number,
  start: string,
  end: string,
): Promise<ActionState> {
  const manager = await requireManager();
  if (weekday < 0 || weekday > 6) return { error: "Bad weekday." };
  if (!TIME_RE.test(start) || !TIME_RE.test(end) || start >= end) {
    return { error: "Times must be HH:MM with start before end." };
  }
  const db = await getDb();
  await db
    .delete(schema.shifts)
    .where(and(eq(schema.shifts.staffId, staffId), eq(schema.shifts.weekday, weekday)));
  await db.insert(schema.shifts).values({ id: newId(), staffId, weekday, start, end });
  await logAudit({
    staffId: manager.staffId,
    action: "roster.set_shift",
    entity: "shifts",
    entityId: staffId,
    diff: { weekday, start, end },
  });
  notify("roster");
  revalidatePath("/roster");
  return {};
}

export async function clearShift(staffId: string, weekday: number): Promise<ActionState> {
  const manager = await requireManager();
  const db = await getDb();
  await db
    .delete(schema.shifts)
    .where(and(eq(schema.shifts.staffId, staffId), eq(schema.shifts.weekday, weekday)));
  await logAudit({
    staffId: manager.staffId,
    action: "roster.clear_shift",
    entity: "shifts",
    entityId: staffId,
    diff: { weekday },
  });
  notify("roster");
  revalidatePath("/roster");
  return {};
}

export async function addTimeOff(
  staffId: string,
  fromDate: string,
  toDate: string,
  reason: string,
): Promise<ActionState> {
  const manager = await requireManager();
  if (!fromDate || !toDate || fromDate > toDate) return { error: "Check the dates." };
  const db = await getDb();
  const id = newId();
  await db.insert(schema.timeOff).values({ id, staffId, fromDate, toDate, reason: reason || null });
  await logAudit({
    staffId: manager.staffId,
    action: "roster.add_time_off",
    entity: "time_off",
    entityId: id,
    diff: { staffId, fromDate, toDate, reason },
  });
  notify("roster");
  revalidatePath("/roster");
  return {};
}

export async function removeTimeOff(id: string): Promise<ActionState> {
  const manager = await requireManager();
  const db = await getDb();
  await db.delete(schema.timeOff).where(eq(schema.timeOff.id, id));
  await logAudit({
    staffId: manager.staffId,
    action: "roster.remove_time_off",
    entity: "time_off",
    entityId: id,
  });
  notify("roster");
  revalidatePath("/roster");
  return {};
}
