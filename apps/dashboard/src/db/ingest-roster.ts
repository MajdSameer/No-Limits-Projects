/**
 * Ingest the weekly roster pushed from the "Live Roster" tab (see
 * api/ingest/roster and scripts/sheets/roster.gs). The sheet's grid says WHO
 * works WHICH day; it doesn't carry clock times, so each worked day becomes a
 * shift at a default start/end (overridable per push, and editable per shift in
 * /manage). The sheet is the source of truth, so a rep's shifts are replaced to
 * match the grid on each push — but only when they actually differ, to avoid
 * needless churn from the 5-minute timer.
 */
import { eq } from "drizzle-orm";

import { hashPin } from "../lib/auth-core";
import { newId } from "../lib/id";
import { slug } from "../lib/slug";
import { schema, type Db } from "./client";

/** One rep's weekly presence. weekdays: 0 = Monday … 6 = Sunday. */
export interface RosterRow {
  name: string;
  weekdays: number[];
}

export interface RosterIngestResult {
  total: number;
  added: string[];
  /** ids whose shift days changed. */
  rosterChanged: string[];
}

const DEFAULT_START = "08:00";
const DEFAULT_END = "17:00";

export async function ingestRoster(
  db: Db,
  rows: RosterRow[],
  opts: { start?: string; end?: string } = {},
): Promise<RosterIngestResult> {
  const start = opts.start ?? DEFAULT_START;
  const end = opts.end ?? DEFAULT_END;
  const result: RosterIngestResult = { total: 0, added: [], rosterChanged: [] };

  for (const row of rows) {
    const name = String(row.name ?? "").trim();
    if (!name) continue;
    const id = slug(name);
    if (!id) continue;
    result.total += 1;

    const want = [...new Set(row.weekdays)]
      .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
      .sort((a, b) => a - b);

    // staff: create if new (default PIN, rotate in /manage), keep name fresh.
    const [existing] = await db
      .select({ name: schema.staff.name })
      .from(schema.staff)
      .where(eq(schema.staff.id, id))
      .limit(1);
    if (!existing) {
      await db.insert(schema.staff).values({ id, name, pinHash: hashPin("1234") });
      result.added.push(id);
    } else if (existing.name !== name) {
      await db.update(schema.staff).set({ name }).where(eq(schema.staff.id, id));
    }

    // Only rewrite shifts if the worked-day set actually changed.
    const current = await db
      .select({ weekday: schema.shifts.weekday })
      .from(schema.shifts)
      .where(eq(schema.shifts.staffId, id));
    const have = [...new Set(current.map((s) => s.weekday))].sort((a, b) => a - b);
    if (have.join(",") === want.join(",")) continue;

    await db.delete(schema.shifts).where(eq(schema.shifts.staffId, id));
    for (const weekday of want) {
      await db.insert(schema.shifts).values({ id: newId(), staffId: id, weekday, start, end });
    }
    result.rosterChanged.push(id);
  }

  return result;
}
