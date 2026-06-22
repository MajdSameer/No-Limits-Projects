/**
 * Site-inspector board: today's inspections per inspector (Martin, Danny…),
 * each job number tagged with the SALES rep whose customer it's for. Read from
 * the "inspectors_live" snapshot the bookings sheet pushes (ingest-inspectors).
 *
 * The inspector BOXES persist day to day (so the wall always shows them), but
 * the COUNT resets when the snapshot is for an older day — a fresh morning
 * starts everyone back at 0 until the sheet pushes today's first inspection.
 */
import { getDb } from "../client";
import { readInspectorSnapshot } from "../ingest-inspectors";
import { sydneyToday } from "../../lib/sydney";

export interface InspectorJobDTO {
  /** MovePro job number of the site inspection. */
  code: string;
  /** Sales rep whose customer the inspection is for (null if unknown). */
  forRep: string | null;
}

export interface InspectorRow {
  id: string;
  name: string;
  count: number;
  jobs: InspectorJobDTO[];
}

export async function inspectorBoard(now: Date = new Date()): Promise<InspectorRow[]> {
  const db = await getDb();
  const snap = await readInspectorSnapshot(db);
  if (!snap) return [];
  const fresh = snap.asOfDate === sydneyToday(now);
  return snap.rows
    .map((r) => {
      const jobs = fresh
        ? r.jobs
            .filter((j) => j.code && String(j.code).trim())
            .map((j) => ({ code: String(j.code).trim(), forRep: j.forRep ?? null }))
        : [];
      return { id: r.id, name: r.name, count: jobs.length, jobs };
    })
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}
