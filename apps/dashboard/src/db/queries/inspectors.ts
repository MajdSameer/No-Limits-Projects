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
  /** Inspections done today (resets each morning). */
  count: number;
  /** Inspections done so far this month (resets on a new month). */
  month: number;
  jobs: InspectorJobDTO[];
}

/**
 * The fixed inspector boxes that always show on the wall, even before the sheet
 * pushes anything. Ids are the name slugs the Apps Script pushes, so a real
 * push overlays straight onto the right box. (Slug names here if more are added.)
 */
const DEFAULT_INSPECTORS: { id: string; name: string }[] = [
  { id: "martin", name: "Martin" },
  { id: "danny", name: "Danny" },
];

export async function inspectorBoard(now: Date = new Date()): Promise<InspectorRow[]> {
  const db = await getDb();
  const snap = await readInspectorSnapshot(db);
  const today = sydneyToday(now);
  const fresh = snap?.asOfDate === today;
  // The month total stays valid all month (re-pushed every 5 min); it only
  // resets when the snapshot is from a previous month.
  const sameMonth = snap?.asOfDate.slice(0, 7) === today.slice(0, 7);

  // Always start with the two fixed boxes so the wall shows Martin & Danny even
  // with nothing pushed yet (counts 0).
  const byId = new Map<string, InspectorRow>(
    DEFAULT_INSPECTORS.map((d) => [d.id, { id: d.id, name: d.name, count: 0, month: 0, jobs: [] }]),
  );

  for (const r of snap?.rows ?? []) {
    const jobs = fresh
      ? r.jobs
          .filter((j) => j.code && String(j.code).trim())
          .map((j) => ({ code: String(j.code).trim(), forRep: j.forRep ?? null }))
      : [];
    const month = sameMonth ? Math.max(0, Math.trunc(Number(r.monthCount) || 0)) : 0;
    // Overlay the pushed data onto the fixed boxes; keep any extra inspectors too.
    byId.set(r.id, { id: r.id, name: r.name, count: jobs.length, month, jobs });
  }

  return [...byId.values()].sort(
    (a, b) => b.month - a.month || b.count - a.count || a.name.localeCompare(b.name),
  );
}
