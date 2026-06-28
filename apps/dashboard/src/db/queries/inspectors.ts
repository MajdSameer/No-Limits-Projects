/**
 * Site-inspector board: this month's inspections per inspector (Martin, Danny…),
 * each job number tagged with the SALES rep whose customer it's for. Read from
 * the "inspectors_live" snapshot the bookings sheet pushes (ingest-inspectors).
 *
 * The count is intentionally NOT scoped to "today": the wall just celebrates
 * whenever an inspector enters a new job number (count-driven on the client), so
 * the day an inspection is booked for doesn't matter. The inspector BOXES
 * persist (so the wall always shows them); the COUNT resets only when the
 * snapshot is from a previous month.
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
  /** Inspections this inspector has entered this month (resets on a new month). */
  count: number;
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
  // The snapshot stays valid all month (re-pushed continuously); the count only
  // resets when it's from a previous month. No daily reset — every job number an
  // inspector enters this month counts and (on the wall) celebrates.
  const sameMonth = snap?.asOfDate.slice(0, 7) === today.slice(0, 7);

  // Always start with the two fixed boxes so the wall shows Martin & Danny even
  // with nothing pushed yet (counts 0).
  const byId = new Map<string, InspectorRow>(
    DEFAULT_INSPECTORS.map((d) => [d.id, { id: d.id, name: d.name, count: 0, jobs: [] }]),
  );

  for (const r of snap?.rows ?? []) {
    const jobs = sameMonth
      ? r.jobs
          .filter((j) => j.code && String(j.code).trim())
          .map((j) => ({ code: String(j.code).trim(), forRep: j.forRep ?? null }))
      : [];
    // Overlay the pushed data onto the fixed boxes; keep any extra inspectors too.
    byId.set(r.id, { id: r.id, name: r.name, count: jobs.length, jobs });
  }

  return [...byId.values()].sort(
    (a, b) => b.count - a.count || a.name.localeCompare(b.name),
  );
}
