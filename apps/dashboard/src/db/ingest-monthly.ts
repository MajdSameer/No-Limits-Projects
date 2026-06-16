/**
 * Ingest the monthly per-rep booking tally pushed from the "Booking" tab
 * (api/ingest/monthly + scripts/sheets/bookings.gs). The sheet counts a booking
 * as a row with a sales person against a move date in the month, so this is the
 * count the floor actually watches — NOT the deduped-by-job-number bookings
 * table. Stored as a single app_settings row per month ("rep_month:yyyy-MM")
 * holding a { repSlug: count } blob, which monthlyBoard reads for roster reps.
 */
import { slug } from "../lib/slug";
import { schema, type Db } from "./client";

export interface MonthlyIngestResult {
  month: string;
  reps: number;
  total: number;
}

const MONTH = /^\d{4}-\d{2}$/;

export function monthSettingKey(month: string): string {
  return `rep_month:${month}`;
}

/**
 * Store a month's per-rep counts. `counts` is keyed by the sheet's rep NAME;
 * names are slugged to staff ids and summed (so spelling/whitespace variants
 * that map to the same rep collapse together).
 */
export async function ingestMonthly(
  db: Db,
  month: string,
  counts: Record<string, number>,
): Promise<MonthlyIngestResult> {
  if (!MONTH.test(month)) throw new Error(`bad month "${month}" (want yyyy-MM)`);

  const bySlug: Record<string, number> = {};
  let total = 0;
  for (const [name, raw] of Object.entries(counts ?? {})) {
    const id = slug(String(name));
    const n = Math.trunc(Number(raw));
    if (!id || !Number.isFinite(n) || n <= 0) continue;
    bySlug[id] = (bySlug[id] ?? 0) + n;
    total += n;
  }

  const key = monthSettingKey(month);
  const value = JSON.stringify(bySlug);
  await db
    .insert(schema.appSettings)
    .values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({ target: schema.appSettings.key, set: { value, updatedAt: new Date() } });

  return { month, reps: Object.keys(bySlug).length, total };
}
