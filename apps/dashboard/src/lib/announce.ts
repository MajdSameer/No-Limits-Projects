/**
 * "Booked!" announcements — the instant celebration fired from the public
 * /booked form. Shared by the form, the API route and the wall display, so the
 * validation rules live in exactly one place.
 */

export interface Announcement {
  /** Sortable id, assigned server-side ("ann:<epoch ms>:<rand>"). */
  key: string;
  /** MovePro job number, upper-case, no "#". */
  job: string;
  /** Who booked it (the submitter). */
  by: string;
  /** The rep the job is being booked for. */
  forRep: string;
  /** Epoch ms the announcement was created. */
  at: number;
}

export interface AnnounceInput {
  job: string;
  by: string;
  forRep: string;
}

/** Prefix of the app_settings rows that hold announcements. */
export const ANNOUNCE_PREFIX = "ann:";

/** "#4ex6rd " → "4EX6RD". Returns null unless it looks like a MovePro job number. */
export function normalizeJob(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.replace(/[\s#]/g, "").toUpperCase();
  return /^[A-Z0-9]{4,12}$/.test(s) ? s : null;
}

/** Trim, collapse inner whitespace, cap length; null if empty/not a string. */
export function cleanName(raw: unknown, max = 40): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.replace(/\s+/g, " ").trim().slice(0, max);
  return s.length > 0 ? s : null;
}

export type ParsedAnnounce = { ok: true; value: AnnounceInput } | { ok: false; error: string };

/** Validate + normalise a submitted form body. */
export function parseAnnounceBody(body: unknown): ParsedAnnounce {
  const b = (body ?? {}) as Record<string, unknown>;
  const job = normalizeJob(b.job);
  if (!job) return { ok: false, error: "That doesn't look like a MovePro job number." };
  const by = cleanName(b.by);
  if (!by) return { ok: false, error: "Please enter your name." };
  const forRep = cleanName(b.forRep);
  if (!forRep) return { ok: false, error: "Please choose who the job is for." };
  return { ok: true, value: { job, by, forRep } };
}

/** Pure: the announcements newer than `after` (by key), oldest first, de-duplicated. */
export function newerThan(items: Announcement[], after: string | null): Announcement[] {
  const seen = new Set<string>();
  return items
    .filter((a) => (after === null || a.key > after) && !seen.has(a.key) && (seen.add(a.key), true))
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}
