/**
 * All day/month bucketing happens on the Australia/Sydney calendar — the
 * floor's clock — regardless of where the server runs. Timestamps stay UTC
 * in the database; these helpers produce the UTC instants that bound Sydney
 * calendar units (DST-correct via date-fns-tz).
 */
import { addDays, addMonths } from "date-fns";
import { format, fromZonedTime, toZonedTime } from "date-fns-tz";

export const SYDNEY_TZ = "Australia/Sydney";

export interface InstantRange {
  start: Date;
  end: Date;
}

/** The Sydney calendar date ("yyyy-MM-dd") containing the given instant. */
export function sydneyToday(now: Date = new Date()): string {
  return format(toZonedTime(now, SYDNEY_TZ), "yyyy-MM-dd", { timeZone: SYDNEY_TZ });
}

function sydneyMidnight(dateStr: string): Date {
  return fromZonedTime(`${dateStr}T00:00:00`, SYDNEY_TZ);
}

/** UTC instants bounding the Sydney day containing `now`. */
export function sydneyDayRange(now: Date = new Date()): InstantRange {
  const today = sydneyToday(now);
  const zoned = toZonedTime(now, SYDNEY_TZ);
  const tomorrow = format(addDays(zoned, 1), "yyyy-MM-dd");
  return { start: sydneyMidnight(today), end: sydneyMidnight(tomorrow) };
}

/** UTC instants bounding the prior Sydney day. */
export function sydneyYesterdayRange(now: Date = new Date()): InstantRange {
  const zoned = toZonedTime(now, SYDNEY_TZ);
  const yesterday = format(addDays(zoned, -1), "yyyy-MM-dd");
  const today = sydneyToday(now);
  return { start: sydneyMidnight(yesterday), end: sydneyMidnight(today) };
}

/** UTC instants bounding the Sydney calendar month containing `now`. */
export function sydneyMonthRange(now: Date = new Date()): InstantRange {
  const zoned = toZonedTime(now, SYDNEY_TZ);
  const first = format(zoned, "yyyy-MM-01");
  const nextFirst = format(addMonths(zoned, 1), "yyyy-MM-01");
  return { start: sydneyMidnight(first), end: sydneyMidnight(nextFirst) };
}

/**
 * Date-string window for the pipeline board: move_date in [1st of this month,
 * 1st three months out) — i.e. the current month + the next two (≈ Jun 1 → Sep
 * 1). `to` is EXCLUSIVE. Compared against the DATE column directly.
 */
export function next3MonthsDateRange(now: Date = new Date()): { from: string; to: string } {
  const zoned = toZonedTime(now, SYDNEY_TZ);
  return { from: format(zoned, "yyyy-MM-01"), to: format(addMonths(zoned, 3), "yyyy-MM-01") };
}
