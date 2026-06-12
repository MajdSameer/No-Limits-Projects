"use server";

import { revalidatePath } from "next/cache";

import { logAudit } from "../../db/audit";
import { getDb, schema } from "../../db/client";
import { todaysEvents } from "../../db/queries/clock";
import { assertTransition, type ClockKind } from "../../lib/clock";
import { newId } from "../../lib/id";
import { notify } from "../../lib/notify";
import { requireManager, requireSession } from "../../lib/session";

export interface PunchState {
  error?: string;
}

export async function punch(kind: ClockKind): Promise<PunchState> {
  const session = await requireSession();
  const db = await getDb();
  const events = await todaysEvents(session.staffId);

  try {
    assertTransition(events, kind);
  } catch {
    return { error: "That doesn't match your current clock state — refresh and try again." };
  }

  await db.insert(schema.clockEvents).values({
    id: newId(),
    staffId: session.staffId,
    kind,
    source: "self",
  });
  await logAudit({
    staffId: session.staffId,
    action: `clock.${kind}`,
    entity: "clock_events",
    entityId: session.staffId,
  });
  notify("clock");
  revalidatePath("/", "layout");
  return {};
}

/** Manager correction — inserts an event at an explicit time, audited. */
export async function correctClock(
  staffId: string,
  kind: ClockKind,
  atISO: string,
  note: string,
): Promise<PunchState> {
  const manager = await requireManager();
  const at = new Date(atISO);
  if (Number.isNaN(at.getTime())) return { error: "Invalid time." };

  const db = await getDb();
  await db.insert(schema.clockEvents).values({
    id: newId(),
    staffId,
    kind,
    at,
    source: "manager",
    editedBy: manager.staffId,
    note,
  });
  await logAudit({
    staffId: manager.staffId,
    action: "clock.correct",
    entity: "clock_events",
    entityId: staffId,
    diff: { kind, at: atISO, note },
  });
  notify("clock");
  revalidatePath("/", "layout");
  return {};
}
