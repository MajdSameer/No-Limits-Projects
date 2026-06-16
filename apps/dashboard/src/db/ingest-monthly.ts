/**
 * Ingest per-rep booking tallies pushed from the "Booking" tab
 * (api/ingest/monthly + scripts/sheets/bookings.gs). The sheet counts a booking
 * as a row with a sales person against a move date in the window, so these are
 * the counts the floor actually watches — NOT the deduped-by-job-number
 * bookings table. Stored as app_settings rows holding a { repSlug: count } blob:
 *   - "rep_month:yyyy-MM" — bookings whose move date is in that month
 *   - "rep_pipeline"      — bookings whose move date is in the current month +
 *                           the next two (the "Next 3 months" board); rolling,
 *                           overwritten on every push.
 */
import { slug } from "../lib/slug";
import { schema, type Db } from "./client";

export interface MonthlyIngestResult {
  month: string;
  reps: number;
  total: number;
}

const MONTH = /^\d{4}-\d{2}$/;
export const PIPELINE_KEY = "rep_pipeline";

export function monthSettingKey(month: string): string {
  return `rep_month:${month}`;
}

/** Slug the sheet's rep NAMES to staff ids and sum (variants collapse). */
function bySlug(counts: Record<string, number>): { map: Record<string, number>; total: number } {
  const map: Record<string, number> = {};
  let total = 0;
  for (const [name, raw] of Object.entries(counts ?? {})) {
    const id = slug(String(name));
    const n = Math.trunc(Number(raw));
    if (!id || !Number.isFinite(n) || n <= 0) continue;
    map[id] = (map[id] ?? 0) + n;
    total += n;
  }
  return { map, total };
}

async function putSetting(db: Db, key: string, value: string): Promise<void> {
  await db
    .insert(schema.appSettings)
    .values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({ target: schema.appSettings.key, set: { value, updatedAt: new Date() } });
}

/** Store a month's per-rep counts under "rep_month:yyyy-MM". */
export async function ingestMonthly(
  db: Db,
  month: string,
  counts: Record<string, number>,
): Promise<MonthlyIngestResult> {
  if (!MONTH.test(month)) throw new Error(`bad month "${month}" (want yyyy-MM)`);
  const { map, total } = bySlug(counts);
  await putSetting(db, monthSettingKey(month), JSON.stringify(map));
  return { month, reps: Object.keys(map).length, total };
}

/** Store the rolling "next 3 months" per-rep counts under "rep_pipeline". */
export async function ingestPipeline(
  db: Db,
  counts: Record<string, number>,
): Promise<{ reps: number; total: number }> {
  const { map, total } = bySlug(counts);
  await putSetting(db, PIPELINE_KEY, JSON.stringify(map));
  return { reps: Object.keys(map).length, total };
}
