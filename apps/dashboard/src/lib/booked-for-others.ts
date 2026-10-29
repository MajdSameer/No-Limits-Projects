import type { Announcement } from "./announce";
import { sydneyToday } from "./sydney";

/** One rep's tally of jobs they booked FOR ANOTHER rep via the /booked form. */
export interface BookedForOthersRow {
  name: string;
  /** Bookings made for someone else today (Sydney). */
  today: number;
  /** Bookings made for someone else this calendar month (Sydney). */
  month: number;
}

/**
 * Pure: counts announcements per submitting rep for today / this month (Sydney).
 * Only submitters who are on `roster` count — the form's Q2 is a pick-list of
 * reps, so this keeps the tally exact (typos and test entries never show) — and
 * a rep booking for THEMSELVES doesn't count: the tracker is specifically "booked
 * for another sales rep". Reps with no bookings this month are omitted; sorted by
 * month desc, then today desc, then name.
 */
export function tallyBookedForOthers(items: Announcement[], roster: string[], now: Date = new Date()): BookedForOthersRow[] {
  const canon = new Map(roster.map((n) => [n.trim().toLowerCase(), n.trim()]));
  const today = sydneyToday(now);
  const month = today.slice(0, 7);
  const rows = new Map<string, BookedForOthersRow>();
  for (const a of items) {
    const by = a.by.trim().toLowerCase();
    const name = canon.get(by);
    if (!name || by === a.forRep.trim().toLowerCase()) continue;
    const day = sydneyToday(new Date(a.at));
    if (day.slice(0, 7) !== month) continue;
    const row = rows.get(name) ?? { name, today: 0, month: 0 };
    row.month += 1;
    if (day === today) row.today += 1;
    rows.set(name, row);
  }
  return [...rows.values()].sort((x, y) => y.month - x.month || y.today - x.today || x.name.localeCompare(y.name));
}
