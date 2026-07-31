/** Pace-arrow math for the Today panel: is a rep's running total ahead of or
 * behind where their month-to-date daily average says they should be by now. */

export const WORKDAY_START_HOUR = 8;
export const WORKDAY_END_HOUR = 18;

/** Fraction of the 8am-6pm Sydney workday elapsed, clamped 0-1. `hoursNow` is
 * decimal Sydney wall-clock hours (e.g. 13.5 for 1:30pm) — timezone
 * extraction happens at the call site so this stays pure and easily tested. */
export function workdayFraction(hoursNow: number): number {
  return Math.min(1, Math.max(0, (hoursNow - WORKDAY_START_HOUR) / (WORKDAY_END_HOUR - WORKDAY_START_HOUR)));
}

export type PaceDirection = "ahead" | "behind";

/** Whether `total` is ahead of or behind the expected-by-now pace, derived
 * from the rep's month-to-date daily average and how much of the workday
 * has elapsed. A total exactly matching expectation counts as ahead. */
export function pace(total: number, mtdDailyAvg: number, hoursNow: number): PaceDirection {
  const expected = mtdDailyAvg * workdayFraction(hoursNow);
  return total >= expected ? "ahead" : "behind";
}
