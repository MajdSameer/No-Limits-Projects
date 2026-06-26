import { eq } from "drizzle-orm";

import { getDb, schema } from "./client";
import { sydneyToday } from "../lib/sydney";

/** Read an app setting, or a fallback when unset. */
export async function getSetting(key: string, fallback = ""): Promise<string> {
  const db = await getDb();
  const [row] = await db.select().from(schema.appSettings).where(eq(schema.appSettings.key, key));
  return row?.value ?? fallback;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db
    .insert(schema.appSettings)
    .values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({ target: schema.appSettings.key, set: { value, updatedAt: new Date() } });
}

export async function isGameDay(): Promise<boolean> {
  return (await getSetting("game_day", "off")) === "on";
}

export interface TopRevenueJob {
  staffId: string;
  name: string;
}

/**
 * The manager-picked winner of the day's "top revenue job" prize on the Game Day
 * board. Per-job revenue isn't in the data pipeline, so this is set by hand and
 * stored with the date it was set for — it auto-clears on a new day (returns null
 * once the stored date is no longer today). Set via setTopRevenueJob.
 */
export async function getTopRevenueJob(
  today: string = sydneyToday(),
): Promise<TopRevenueJob | null> {
  const raw = await getSetting("top_revenue_job", "");
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as { date?: string; staffId?: string; name?: string };
    if (o?.date !== today || !o.staffId || !o.name) return null;
    return { staffId: o.staffId, name: o.name };
  } catch {
    return null;
  }
}

/**
 * The floor's authoritative "total bookings this month" as pushed from the
 * Follow-Up sheet's own grand-total cell (Leaderboard "Total bookings: N").
 * Stored with the month it's for so it auto-clears next month (returns null once
 * it's no longer the current Sydney month → callers fall back to the board sum).
 * This is the curated floor total (specific tracked reps incl. managers/ex-reps),
 * which differs from both the active-rep board sum and the raw Booking-tab blob.
 */
export async function getSheetMonthTotal(now: Date = new Date()): Promise<number | null> {
  const raw = await getSetting("sheet_month_total", "");
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as { month?: string; total?: number };
    const month = sydneyToday(now).slice(0, 7);
    if (o?.month !== month || typeof o.total !== "number" || !Number.isFinite(o.total)) return null;
    return o.total;
  } catch {
    return null;
  }
}

export async function setSheetMonthTotal(month: string, total: number): Promise<void> {
  await setSetting("sheet_month_total", JSON.stringify({ month, total: Math.round(total) }));
}

/** Combined team monthly booking goal. Default 1995 = 17 reps × Tier 3 (115). */
export async function getMonthlyGoal(): Promise<number> {
  const n = Number(await getSetting("monthly_goal", "1995"));
  return Number.isFinite(n) && n > 0 ? n : 1995;
}
