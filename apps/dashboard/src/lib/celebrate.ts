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
}

/**
 * Pure: given the current daily rows and the per-rep counts we last saw,
 * return a pop for every rep whose count went UP (one per rep, carrying the
 * latest MovePro code), and update `prev` to the new counts. Reps not yet in
 * `prev` are only seeded — they don't fire — so a fresh page load is silent.
 */
export function risenBookings(rows: DailyCountRow[], prev: Map<string, number>): BookingPop[] {
  const pops: BookingPop[] = [];
  for (const r of rows) {
    const before = prev.get(r.staffId);
    if (before !== undefined && r.count > before) {
      pops.push({ staffId: r.staffId, name: r.name, code: r.jobCodes?.at(-1) ?? null });
    }
    prev.set(r.staffId, r.count);
  }
  return pops;
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

/** Play a metallic gong — inharmonic partials + a struck-noise transient. */
export function playGong(volume = 0.55): void {
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") void c.resume();
  const now = c.currentTime;

  const master = c.createGain();
  master.gain.value = volume;
  master.connect(c.destination);

  // Inharmonic partials give the shimmering metallic "gong" timbre.
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
    g.gain.exponentialRampToValueAtTime(0.0001, now + 3.4 + i * 0.25);
    osc.connect(g);
    g.connect(master);
    osc.start(now);
    osc.stop(now + 4.2);
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
