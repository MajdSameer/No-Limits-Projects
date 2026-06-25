/**
 * Ingest the SUBCONTRACTOR's daily/monthly tally pushed by the Follow-Up
 * sheet's Apps Script (see api/ingest/subcontractors and
 * scripts/sheets/subcontractors.gs). The subcontractor (Domanic) has a
 * "Today's N / 12" and a running "Monthly" total in a section of the
 * Leaderboard tab.
 *
 * This is volatile floor data, so it lives as a
 * single JSON blob in app_settings ("subcontractors_live") — no schema change,
 * and each push overwrites it. The board resets the daily count to 0 on a new
 * day (the snapshot's asOfDate no longer matches), while the box stays.
 */
import { eq } from "drizzle-orm";

import { slug } from "../lib/slug";
import { sydneyToday } from "../lib/sydney";
import { schema, type Db } from "./client";

/** Stable app_settings key holding the latest subcontractors snapshot. */
export const SUBCONTRACTORS_KEY = "subcontractors_live";

/** One subcontractor row from the Apps Script payload. Only `name` is required. */
export interface SubcontractorRowIn {
  name: string;
  /** Jobs done TODAY (the "Today's N" cell). */
  count?: number | null;
  /** Jobs done so far THIS month (the "Monthly" cell). */
  monthCount?: number | null;
  /** Optional job refs shown today (cosmetic only; not rendered on the box). */
  jobs?: (string | null)[] | null;
}

export interface SubcontractorSnapshotRow {
  id: string;
  name: string;
  /** Today's job count (resets each morning on the board). */
  count: number;
  /** This month's running job total (resets on a new month). */
  monthCount: number;
  jobs: string[];
}

/** What we store under SUBCONTRACTORS_KEY. */
export interface SubcontractorSnapshot {
  asOfDate: string;
  rows: SubcontractorSnapshotRow[];
}

function cleanStr(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0;
}

export interface SubcontractorIngestResult {
  asOfDate: string;
  subcontractors: number;
}

/**
 * Overwrite the subcontractors snapshot with today's push. Subcontractors are
 * kept even with a zero count so their box still shows on the board. Counts are
 * taken as the max seen for an id (a re-send never lowers the live number).
 */
export async function ingestSubcontractors(
  db: Db,
  rows: SubcontractorRowIn[],
  asOfDate: string = sydneyToday(),
): Promise<SubcontractorIngestResult> {
  const byId = new Map<string, SubcontractorSnapshotRow>();

  for (const row of rows) {
    const name = cleanStr(row.name);
    if (!name) continue;
    const id = slug(name);
    if (!id) continue;

    const existing = byId.get(id) ?? { id, name, count: 0, monthCount: 0, jobs: [] };
    existing.count = Math.max(existing.count, num(row.count));
    existing.monthCount = Math.max(existing.monthCount, num(row.monthCount));
    for (const j of row.jobs ?? []) {
      const c = cleanStr(j);
      if (c && !existing.jobs.includes(c)) existing.jobs.push(c);
    }
    byId.set(id, existing);
  }

  const snapshot: SubcontractorSnapshot = { asOfDate, rows: [...byId.values()] };
  await db
    .insert(schema.appSettings)
    .values({ key: SUBCONTRACTORS_KEY, value: JSON.stringify(snapshot), updatedAt: new Date() })
    .onConflictDoUpdate({
      target: schema.appSettings.key,
      set: { value: JSON.stringify(snapshot), updatedAt: new Date() },
    });

  return { asOfDate, subcontractors: snapshot.rows.length };
}

/** Read the stored snapshot (or null). Shared by the board query. */
export async function readSubcontractorSnapshot(db: Db): Promise<SubcontractorSnapshot | null> {
  const [row] = await db
    .select({ value: schema.appSettings.value })
    .from(schema.appSettings)
    .where(eq(schema.appSettings.key, SUBCONTRACTORS_KEY));
  if (!row?.value) return null;
  try {
    const snap = JSON.parse(row.value) as SubcontractorSnapshot;
    if (!snap || typeof snap.asOfDate !== "string" || !Array.isArray(snap.rows)) return null;
    return snap;
  } catch {
    return null;
  }
}
