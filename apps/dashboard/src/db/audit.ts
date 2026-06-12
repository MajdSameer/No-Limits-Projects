import { newId } from "../lib/id";
import { getDb, schema } from "./client";

/**
 * Append to the audit trail. Never throws — an audit failure must not break
 * the action it documents (it is logged for investigation instead).
 */
export async function logAudit(entry: {
  staffId: string;
  action: string;
  entity: string;
  entityId: string;
  diff?: unknown;
}): Promise<void> {
  try {
    const db = await getDb();
    await db.insert(schema.auditLog).values({
      id: newId(),
      staffId: entry.staffId,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId,
      diff: entry.diff ?? null,
    });
  } catch (err) {
    console.error("audit write failed", entry.action, err);
  }
}
