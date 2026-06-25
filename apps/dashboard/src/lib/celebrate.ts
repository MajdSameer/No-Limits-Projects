"use client";

import confetti from "canvas-confetti";

/**
 * Daily milestone celebration: when a rep reaches N bookings for the day, the
 * board plays a gong out loud and throws confetti. Fires once per rep per day.
 */

/** How many bookings in a day triggers the gong. */
export const GONG_THRESHOLD = 3;

interface CountedRow {
  staffId: string;
  name: string;
  count: number;
}

/**
 * Pure: returns the names of reps who have reached `threshold` and aren't yet
 * in `seen`, and adds them to `seen`. Deterministic + unit-testable.
 */
export function crossedThreshold(
  rows: CountedRow[],
  seen: Set<string>,
  threshold: number,
): string[] {
  const fresh: string[] = [];
  for (const r of rows) {
    if (r.count >= threshold && !seen.has(r.staffId)) {
      seen.add(r.staffId);
      fresh.push(r.name);
    }
  }
  return fresh;
}

// ── Per-booking pop: fire the instant a rep's count ticks up ─────────────

export interface DailyCountRow {
  staffId: string;
  name: string;
  count: number;
  /** MovePro codes behind today's count; the last is the newest booking. */
  jobCodes?: string[];
}

export interface BookingPop {
  staffId: string;
  name: string;
  /** The MovePro number of the booking that just landed, if known. */
  code: string | null;
  /** "rep" booking (default) or a subcontractor job. */
  kind?: "rep" | "subcontractor";
}

/** Mutable per-session memory for the live celebration. Create one per board. */
export interface CelebrateState {
  /** MovePro codes already shown as a label, so the same number isn't repeated. */
  seenCodes: Set<string>;
  /** Bookings already celebrated per rep (high-water that can fall — see below). */
  fired: Map<string, number>;
  /** Consecutive polls a rep's count has sat below `fired` (drop debounce). */
  lowFor: Map<string, number>;
}

/** A rep's count must sit below its celebrated high-water for this many polls
 * before we trust the drop. One stale poll from another server instance is a
 * blip and is ignored; a real delete persists and is accepted, so re-adding the
 * booking celebrates again. */
const DROP_PERSIST = 2;

/** Fresh, empty celebration memory. */
export function createCelebrateState(): CelebrateState {
  return { seenCodes: new Set(), fired: new Map(), lowFor: new Map() };
}

/**
 * Pure: new bookings since we last looked. The rep's COUNT drives how many pops
 * fire — so the 6th, 7th… booking still pops even though the Leaderboard sheet
 * only pushes a handful of MovePro codes per rep (codes are just cosmetic labels,
 * never a trigger). The celebrated count is a high-water mark so stale polls that
 * dip the number don't re-fire — but a dip that PERSISTS for `DROP_PERSIST` polls
 * is taken as a real delete and lowers the mark, so deleting a booking and
 * re-entering it later celebrates and gongs again. A label is forgotten the
 * moment its code leaves the board, so a re-added booking shows its number again.
 * On the seed pass it only records state and returns nothing, so a page load is
 * silent. Mutates `state`.
 */
export function newBookings(
  rows: DailyCountRow[],
  state: CelebrateState,
  seed: boolean,
): BookingPop[] {
  const { seenCodes, fired, lowFor } = state;
  const pops: BookingPop[] = [];

  // Forget labels for codes no longer on the board (purely cosmetic — never
  // gongs — so a deleted-then-re-added booking shows its MovePro number again).
  const present = new Set<string>();
  for (const r of rows) {
    for (const c of r.jobCodes ?? []) {
      const code = String(c).trim();
      if (code) present.add(code);
    }
  }
  for (const c of [...seenCodes]) if (!present.has(c)) seenCodes.delete(c);

  for (const r of rows) {
    const codes = (r.jobCodes ?? []).map((c) => String(c).trim()).filter(Boolean);
    const freshCodes = codes.filter((c) => !seenCodes.has(c));
    const target = Math.max(0, r.count);
    const prev = fired.get(r.staffId) ?? 0;

    if (target > prev) {
      // New bookings — one pop each, labelled with any not-yet-shown code.
      if (!seed) {
        for (let i = 0; i < target - prev; i++) {
          pops.push({ staffId: r.staffId, name: r.name, code: freshCodes[i] ?? null });
        }
      }
      fired.set(r.staffId, target);
      lowFor.delete(r.staffId);
    } else if (target < prev) {
      // Dropped below the high-water. Could be a real delete or just a stale
      // snapshot from another instance — only trust it once it persists.
      const misses = (lowFor.get(r.staffId) ?? 0) + 1;
      if (misses >= DROP_PERSIST) {
        fired.set(r.staffId, target); // accept it → re-adding the booking re-fires
        lowFor.delete(r.staffId);
      } else {
        lowFor.set(r.staffId, misses);
      }
    } else {
      lowFor.delete(r.staffId);
    }

    for (const c of freshCodes) seenCodes.add(c);
  }
  return pops;
}

// ── Subcontractor jobs: count-driven pop, no job-code label (the sheet's job
//    column is free text, so we just pop the subcontractor's name) ───────────

/** One subcontractor's live row for the celebration: today's job count. */
export interface SubcontractorCountRow {
  staffId: string;
  name: string;
  count: number;
}

/**
 * Pure: new subcontractor jobs since we last looked. Reuses {@link newBookings}
 * (count-driven, drop-debounced, seeded-silent) over the subcontractor's today
 * count, then tags each pop as a subcontractor job. No MovePro code is attached
 * (the sheet's job column is free text), so the pop just shows the name. Mutates
 * `state`.
 */
export function subcontractorBookings(
  rows: SubcontractorCountRow[],
  state: CelebrateState,
  seed: boolean,
): BookingPop[] {
  const base = newBookings(
    rows.map((r) => ({ staffId: r.staffId, name: r.name, count: r.count })),
    state,
    seed,
  );
  return base.map((p) => ({ ...p, kind: "subcontractor" as const, code: null }));
}

// ── Web Audio gong (synthesised — no asset, works offline) ───────────────
let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const w = window as unknown as { webkitAudioContext?: typeof AudioContext };
    const AC = window.AudioContext ?? w.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  return ctx;
}

/** Resume the audio context after a user gesture (browser autoplay policy). */
export function armAudio(): void {
  const c = getCtx();
  if (c && c.state === "suspended") void c.resume();
}

/**
 * Whether sound can actually play right now (the context exists and the browser
 * has unlocked it). False on a fresh wall display until someone interacts —
 * the board shows a "tap to enable sound" prompt while this is false.
 */
export function audioRunning(): boolean {
  return !!ctx && ctx.state === "running";
}

/** Play a metallic gong — inharmonic partials + a struck-noise transient. */
export function playGong(volume = 0.55): void {
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") void c.resume();
  const now = c.currentTime;

  const master = c.createGain();
  master.gain.value = volume;
  master.connect(c.destination);

  // Inharmonic partials give the shimmering metallic "gong" timbre. Long decay
  // so it rings out for several seconds.
  const base = 110;
  const partials = [1, 2.71, 5.15, 8.6, 12.2];
  partials.forEach((ratio, i) => {
    const osc = c.createOscillator();
    osc.type = "sine";
    osc.frequency.value = base * ratio * (1 + Math.random() * 0.008);
    const g = c.createGain();
    const peak = 0.6 / (i + 1);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(peak, now + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 8 + i * 0.5);
    osc.connect(g);
    g.connect(master);
    osc.start(now);
    osc.stop(now + 9.5);
  });

  // Short filtered noise = the mallet strike.
  const dur = 0.2;
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const noise = c.createBufferSource();
  noise.buffer = buf;
  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 1200;
  bp.Q.value = 0.6;
  const ng = c.createGain();
  ng.gain.setValueAtTime(0.5, now);
  ng.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  noise.connect(bp);
  bp.connect(ng);
  ng.connect(master);
  noise.start(now);
  noise.stop(now + dur);
}

const GONG_COLORS = ["#ffd42e", "#fff389", "#f472b6", "#38bdf8", "#f4f1e8"];

/** Gong + a big confetti burst (confetti skipped under reduced-motion). */
export function celebrateGong(): void {
  playGong();
  if (typeof window !== "undefined" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    confetti({ particleCount: 240, spread: 130, startVelocity: 45, origin: { y: 0.5 }, colors: GONG_COLORS });
  }
}
