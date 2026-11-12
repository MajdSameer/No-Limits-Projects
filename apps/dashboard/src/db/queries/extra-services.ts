import { getDb } from "../client";
import { EXTRA_SERVICES_KEY, type ExtraServicesSnapshot } from "../ingest-extra-services";
import { getSetting } from "../settings";
import { sydneyToday } from "../../lib/sydney";

export interface ExtraServicesRow {
  id: string;
  name: string;
  /** Jobs booked today. */
  count: number;
  /** Jobs booked this month. */
  month: number;
  target: number | null;
  jobs: { code: string; forRep: string | null }[];
}

/** The extra-services card. Always returns a card (Clara, zeros) so it shows on the wall
 * before the sheet has pushed anything; today's numbers reset on a new day, the month
 * total stays valid for the whole month. */
export async function extraServicesBoard(now: Date = new Date()): Promise<ExtraServicesRow> {
  await getDb();
  let snap: ExtraServicesSnapshot | null;
  try {
    const raw = await getSetting(EXTRA_SERVICES_KEY, "");
    snap = raw ? (JSON.parse(raw) as ExtraServicesSnapshot) : null;
  } catch {
    snap = null;
  }
  const today = sydneyToday(now);
  const fresh = snap?.asOfDate === today;
  const sameMonth = snap?.asOfDate?.slice(0, 7) === today.slice(0, 7);
  const jobs = fresh ? (snap?.jobs ?? []) : [];
  return {
    id: snap?.id ?? "clara",
    name: snap?.name ?? "Clara",
    count: jobs.length,
    month: sameMonth ? Math.max(0, snap?.monthCount ?? 0) : 0,
    target: snap?.target ?? null,
    jobs,
  };
}
