/**
 * Ingest the day's SITE INSPECTIONS pushed by the bookings sheet's Apps Script
 * (see api/ingest/inspectors and scripts/sheets/inspectors.gs). Each site
 * inspector (e.g. Martin, Danny) gets today's job numbers, and every job carries
 * the SALES rep whose customer the inspection is for.
 *
 * Like the monthly/pipeline tallies, this is volatile floor data, so it lives as
 * a single JSON blob in app_settings ("inspectors_live") — no schema change, and
 * each push overwrites the mirror. The board resets the count to 0 on a new day
 * (the snapshot's asOfDate no longer matches), while the inspector boxes stay.
 */
import { eq } from "drizzle-orm";

import { slug } from "../lib/slug";
import { sydneyToday } from "../lib/sydney";
import { schema, type Db } from "./client";

/** Stable app_settings key holding the latest inspectors snapshot. */
export const INSPECTORS_KEY = "inspectors_live";

/** One job (site inspection) the inspector has today. */
export interface InspectorJobIn {
  code?: string | null;
  forRep?: string | null;
}

/** One inspector row from the Apps Script payload. Only `name` is required. */
export interface InspectorRowIn {
  name: string;
  jobs?: InspectorJobIn[] | null;
  /** Inspections this inspector has done so far THIS month (entry tab, by date). */
  monthCount?: number | null;
}

export interface InspectorJob {
  code: string;
  forRep: string | null;
}

export interface InspectorSnapshotRow {
  id: string;
  name: string;
  jobs: InspectorJob[];
  /** This month's running inspection total (0 if the sheet didn't send one). */
  monthCount: number;
}

/** What we store under INSPECTORS_KEY. */
export interface InspectorSnapshot {
  asOfDate: string;
  rows: InspectorSnapshotRow[];
}

function cleanStr(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

/**
 * A MovePro job number is always exactly 5 alphanumeric characters (e.g.
 * "AY3VA", "3KZ3P", or all letters like "EDPAG"). The sheet's job-number column
 * occasionally gets a stray value typed into it — a name ("Andy") or a loose
 * number ("1") — which would otherwise be counted as a phantom inspection. The
 * 5-char length is what separates a real code from those strays. We deliberately
 * do NOT require a mix of letters and digits: real codes can be all letters
 * (EDPAG was dropped by that stricter rule and never counted/celebrated).
 */
export function isJobCode(code: string): boolean {
  return /^[A-Za-z0-9]{5}$/.test(code);
}

export interface InspectorIngestResult {
  asOfDate: string;
  inspectors: number;
  jobs: number;
}

/**
 * Overwrite the inspectors snapshot with today's push. Inspectors with no
 * job-numbered inspections today are kept (with an empty job list) so their box
 * still shows on the board. Jobs without a valid MovePro job number (a 5-char
 * alphanumeric code, see isJobCode) are dropped — a site inspection only counts
 * once it has a real job number to celebrate, so stray cell values don't inflate
 * the daily tally.
 */
export async function ingestInspectors(
  db: Db,
  rows: InspectorRowIn[],
  asOfDate: string = sydneyToday(),
): Promise<InspectorIngestResult> {
  const byId = new Map<string, InspectorSnapshotRow>();

  for (const row of rows) {
    const name = cleanStr(row.name);
    if (!name) continue;
    const id = slug(name);
    if (!id) continue;

    const existing = byId.get(id) ?? { id, name, jobs: [], monthCount: 0 };
    const seen = new Set(existing.jobs.map((j) => j.code));
    for (const j of row.jobs ?? []) {
      const code = cleanStr(j?.code);
      if (!code || !isJobCode(code) || seen.has(code)) continue; // valid job #; dedupe
      seen.add(code);
      existing.jobs.push({ code, forRep: cleanStr(j?.forRep) });
    }
    const m = Number(row.monthCount);
    if (Number.isFinite(m) && m > existing.monthCount) existing.monthCount = Math.trunc(m);
    byId.set(id, existing);
  }

  const snapshot: InspectorSnapshot = { asOfDate, rows: [...byId.values()] };
  await db
    .insert(schema.appSettings)
    .values({ key: INSPECTORS_KEY, value: JSON.stringify(snapshot), updatedAt: new Date() })
    .onConflictDoUpdate({
      target: schema.appSettings.key,
      set: { value: JSON.stringify(snapshot), updatedAt: new Date() },
    });

  return {
    asOfDate,
    inspectors: snapshot.rows.length,
    jobs: snapshot.rows.reduce((s, r) => s + r.jobs.length, 0),
  };
}

/** Read the stored snapshot (or null). Shared by the board query. */
export async function readInspectorSnapshot(db: Db): Promise<InspectorSnapshot | null> {
  const [row] = await db
    .select({ value: schema.appSettings.value })
    .from(schema.appSettings)
    .where(eq(schema.appSettings.key, INSPECTORS_KEY));
  if (!row?.value) return null;
  try {
    const snap = JSON.parse(row.value) as InspectorSnapshot;
    if (!snap || typeof snap.asOfDate !== "string" || !Array.isArray(snap.rows)) return null;
    return snap;
  } catch {
    return null;
  }
}
