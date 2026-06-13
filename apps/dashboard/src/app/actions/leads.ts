"use server";

import { revalidatePath } from "next/cache";

import { logAudit } from "../../db/audit";
import { getDb, schema } from "../../db/client";
import { liveAllocation } from "../../db/queries/allocation";
import { newId } from "../../lib/id";
import { notify } from "../../lib/notify";
import { requireSession } from "../../lib/session";

export interface AssignResult {
  assignedTo?: string;
  error?: string;
}

/** Assign the next lead to whoever the allocator says is up. */
export async function assignNextLead(): Promise<AssignResult> {
  const session = await requireSession();
  const alloc = await liveAllocation();
  if (!alloc.nextUp) {
    return { error: "Nobody's clocked in and off-break right now." };
  }
  const db = await getDb();
  const slot = alloc.eligible.find((e) => e.staffId === alloc.nextUp);
  await db.insert(schema.leads).values({
    id: newId(),
    staffId: alloc.nextUp,
    assignedBy: session.staffId,
    source: "allocator",
  });
  await logAudit({
    staffId: session.staffId,
    action: "lead.assign",
    entity: "leads",
    entityId: alloc.nextUp,
  });
  notify("clock"); // allocation panel listens on clock/bookings
  notify("bookings");
  revalidatePath("/");
  return { assignedTo: slot?.name ?? alloc.nextUp };
}
