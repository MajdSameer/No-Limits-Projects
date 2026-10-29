import { and, desc, gt, gte, like, lt } from "drizzle-orm";

import { getDb, schema } from "./client";
import { ANNOUNCE_PREFIX, type Announcement, type AnnounceInput } from "../lib/announce";

/**
 * Announcements live in the existing app_settings key/value table (one row each,
 * key = "ann:<epoch ms, zero-padded>:<rand>", value = JSON) — so the instant
 * /booked celebration needs NO schema migration on production. Keys sort
 * chronologically, so "everything after key K" is a simple range read.
 */

const KEEP_MS = 120 * 24 * 3600 * 1000; // kept ~4 months: the /live "booked for others" tracker counts this month
const DEDUPE_MS = 2 * 60 * 1000; // the same job number twice within 2 min = a double-tap

function makeKey(at: number): string {
  const rand = Math.random().toString(36).slice(2, 6);
  return `${ANNOUNCE_PREFIX}${String(at).padStart(13, "0")}:${rand}`;
}

function parseRow(key: string, value: string): Announcement | null {
  try {
    const v = JSON.parse(value) as Partial<Announcement>;
    if (!v || typeof v.job !== "string" || typeof v.by !== "string" || typeof v.forRep !== "string") return null;
    return { key, job: v.job, by: v.by, forRep: v.forRep, at: Number(v.at) || 0 };
  } catch {
    return null;
  }
}

/** Newest announcements first (small window — used for de-duping + the baseline). */
async function recent(limit: number): Promise<Announcement[]> {
  const db = await getDb();
  const rows = await db
    .select({ key: schema.appSettings.key, value: schema.appSettings.value })
    .from(schema.appSettings)
    .where(like(schema.appSettings.key, `${ANNOUNCE_PREFIX}%`))
    .orderBy(desc(schema.appSettings.key))
    .limit(limit);
  return rows.map((r) => parseRow(r.key, r.value)).filter((a): a is Announcement => a !== null);
}

/**
 * Stores an announcement and returns it. A repeat of the same job number inside
 * DEDUPE_MS returns the existing one with `duplicate: true` and does NOT create
 * a second celebration (a double-tap on Submit must not gong twice).
 */
export async function addAnnouncement(
  input: AnnounceInput,
  now: number = Date.now(),
): Promise<{ announcement: Announcement; duplicate: boolean }> {
  const existing = (await recent(20)).find((a) => a.job === input.job && now - a.at < DEDUPE_MS);
  if (existing) return { announcement: existing, duplicate: true };

  const db = await getDb();
  const key = makeKey(now);
  const announcement: Announcement = { key, job: input.job, by: input.by, forRep: input.forRep, at: now };
  await db
    .insert(schema.appSettings)
    .values({ key, value: JSON.stringify({ job: input.job, by: input.by, forRep: input.forRep, at: now }), updatedAt: new Date(now) });

  // Opportunistic prune so the table never grows without bound.
  await db
    .delete(schema.appSettings)
    .where(and(like(schema.appSettings.key, `${ANNOUNCE_PREFIX}%`), lt(schema.appSettings.key, makeKey(now - KEEP_MS))));
  return { announcement, duplicate: false };
}

/** Every announcement made at or after `sinceMs`, oldest first (capped) — feeds the /live tracker. */
export async function announcementsSince(sinceMs: number, limit = 5000): Promise<Announcement[]> {
  const db = await getDb();
  const rows = await db
    .select({ key: schema.appSettings.key, value: schema.appSettings.value })
    .from(schema.appSettings)
    .where(and(like(schema.appSettings.key, `${ANNOUNCE_PREFIX}%`), gte(schema.appSettings.key, `${ANNOUNCE_PREFIX}${String(Math.max(0, sinceMs)).padStart(13, "0")}`)))
    .orderBy(schema.appSettings.key)
    .limit(limit);
  return rows.map((r) => parseRow(r.key, r.value)).filter((a): a is Announcement => a !== null);
}

/** The newest key — a screen's starting point, so loading/reloading never replays old ones. */
export async function latestAnnouncementKey(): Promise<string | null> {
  return (await recent(1))[0]?.key ?? null;
}

/** Announcements strictly newer than `after`, oldest first (capped). */
export async function announcementsAfter(after: string, limit = 10): Promise<Announcement[]> {
  const db = await getDb();
  const rows = await db
    .select({ key: schema.appSettings.key, value: schema.appSettings.value })
    .from(schema.appSettings)
    .where(and(like(schema.appSettings.key, `${ANNOUNCE_PREFIX}%`), gt(schema.appSettings.key, after)))
    .orderBy(schema.appSettings.key)
    .limit(limit);
  return rows.map((r) => parseRow(r.key, r.value)).filter((a): a is Announcement => a !== null);
}
