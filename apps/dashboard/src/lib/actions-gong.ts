"use client";

/**
 * /actions celebration gong: each time a rep's Today calls/emails/messages
 * individually crosses 100, the wall gongs and shows a brief banner. Reuses
 * the audio primitives from celebrate.ts (playGong, armAudio, audioRunning,
 * startAudioKeepAlive) — this module only owns the crossing-detection logic,
 * which is a different trigger domain (three independent per-metric
 * thresholds, not a single booking count).
 */

export const GONG_THRESHOLD = 100;

export type GongMetric = "calls" | "emails" | "messages";

export interface GongEvent {
  name: string;
  metric: GongMetric;
  value: number;
}

const METRICS: GongMetric[] = ["calls", "emails", "messages"];

/**
 * Pure: reps' calls/emails/messages that just crossed 100 since the last
 * check. `seen` is a Set of "name|metric" keys already gonged TODAY —
 * mutated to add newly-crossed ones (the caller scopes/persists it per day).
 * On a seed pass (`seed: true`) everything currently ≥100 is silently added
 * to `seen` without being returned, so a fresh page load — or a rep who was
 * already over 100 before anyone was watching — never gongs; only an
 * observed crossing does. */
export function crossedGongThreshold(
  rows: { name: string; calls: number; emails: number; messages: number }[],
  seen: Set<string>,
  seed: boolean,
): GongEvent[] {
  const events: GongEvent[] = [];
  for (const r of rows) {
    for (const metric of METRICS) {
      const value = r[metric];
      if (value < GONG_THRESHOLD) continue;
      const key = `${r.name}|${metric}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (!seed) events.push({ name: r.name, metric, value });
    }
  }
  return events;
}

const STORAGE_PREFIX = "nl-actions-gongs-";

/** Loads the set of "name|metric" keys already gonged for `day` — the day is
 * baked into the storage key itself, so a new calendar day naturally starts
 * empty (the reset "at midnight" the caller relies on) with no explicit
 * cleanup needed. */
export function loadGongSeen(day: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + day);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

export function saveGongSeen(day: string, seen: Set<string>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_PREFIX + day, JSON.stringify([...seen]));
  } catch {
    // Storage full/unavailable/private-browsing — non-fatal, just won't
    // survive a reload; the seed pass still prevents a burst of stale gongs.
  }
}
