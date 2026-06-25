/**
 * Subcontractor board: the subcontractor's (Domanic's) jobs today against a
 * fixed daily target, plus a running monthly total — read from the
 * "subcontractors_live" snapshot the Follow-Up sheet pushes
 * (ingest-subcontractors).
 *
 * The subcontractor BOX persists day to day (so the
 * wall always shows it), but the COUNT resets when the snapshot is for an older
 * day — a fresh morning starts back at 0 until the sheet pushes today's first
 * job.
 */
import { getDb } from "../client";
import { readSubcontractorSnapshot } from "../ingest-subcontractors";
import { sydneyToday } from "../../lib/sydney";

/** Fixed daily target shown as "N / TARGET" on the subcontractor box. */
export const SUBCONTRACTOR_DAILY_TARGET = 12;

export interface SubcontractorRow {
  id: string;
  name: string;
  /** Jobs done today (resets each morning). */
  count: number;
  /** Jobs done so far this month (resets on a new month). */
  month: number;
  /** Fixed daily target the count is shown against. */
  target: number;
  jobs: string[];
}

/**
 * The fixed subcontractor box that always shows on the wall, even before the
 * sheet pushes anything. The id is the name slug the Apps Script pushes, so a
 * real push overlays straight onto the right box.
 */
const DEFAULT_SUBCONTRACTORS: { id: string; name: string }[] = [
  { id: "domanic", name: "Domanic" },
];

export async function subcontractorBoard(now: Date = new Date()): Promise<SubcontractorRow[]> {
  const db = await getDb();
  const snap = await readSubcontractorSnapshot(db);
  const today = sydneyToday(now);
  const fresh = snap?.asOfDate === today;
  // The month total stays valid all month (re-pushed every few min); it only
  // resets when the snapshot is from a previous month.
  const sameMonth = snap?.asOfDate.slice(0, 7) === today.slice(0, 7);

  const byId = new Map<string, SubcontractorRow>(
    DEFAULT_SUBCONTRACTORS.map((d) => [
      d.id,
      { id: d.id, name: d.name, count: 0, month: 0, target: SUBCONTRACTOR_DAILY_TARGET, jobs: [] },
    ]),
  );

  for (const r of snap?.rows ?? []) {
    const count = fresh ? Math.max(0, Math.trunc(Number(r.count) || 0)) : 0;
    const month = sameMonth ? Math.max(0, Math.trunc(Number(r.monthCount) || 0)) : 0;
    const jobs = fresh ? (r.jobs ?? []).map((j) => String(j).trim()).filter(Boolean) : [];
    byId.set(r.id, {
      id: r.id,
      name: r.name,
      count,
      month,
      target: SUBCONTRACTOR_DAILY_TARGET,
      jobs,
    });
  }

  return [...byId.values()].sort(
    (a, b) => b.month - a.month || b.count - a.count || a.name.localeCompare(b.name),
  );
}
