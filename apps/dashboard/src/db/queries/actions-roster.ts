import { and, asc, eq } from "drizzle-orm";

import { alignRoster, getActionsSnapshot, type ActionsResponseDTO } from "../../lib/movepro-actions";
import { getDb, schema } from "../client";

const ROSTER_TTL_MS = 60_000;
let rosterCache: { at: number; names: string[] } | null = null;

/** The dashboard's active reps (what /live lists) — the single source of truth
 * for "who is on the /actions boards". Cached briefly; on a DB error serves the
 * last good roster, or [] (callers then skip alignment rather than blank the
 * board). */
async function activeRepNames(): Promise<string[]> {
  if (rosterCache && Date.now() - rosterCache.at < ROSTER_TTL_MS) return rosterCache.names;
  try {
    const db = await getDb();
    const rows = await db
      .select({ name: schema.staff.name })
      .from(schema.staff)
      .where(and(eq(schema.staff.active, true), eq(schema.staff.role, "rep")))
      .orderBy(asc(schema.staff.name));
    const names = rows.map((r) => r.name);
    rosterCache = { at: Date.now(), names };
    return names;
  } catch (err) {
    console.error("actions roster lookup failed:", err);
    return rosterCache?.names ?? [];
  }
}

/** The /actions activity snapshot with the daily and monthly lists aligned to the
 * same people (see alignRoster). Used by both the page and the API route so the
 * server-rendered first paint and every poll agree. */
export async function getAlignedActionsSnapshot(): Promise<ActionsResponseDTO> {
  const snap = await getActionsSnapshot();
  const roster = await activeRepNames();
  if (roster.length === 0) return snap;
  return { ...snap, daily: alignRoster(snap.daily, roster), monthly: alignRoster(snap.monthly, roster) };
}
