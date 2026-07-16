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
  /** "rep" booking (default) or a site-inspection. */
  kind?: "rep" | "inspector";
  /** Site inspections only: the SALES rep whose customer this inspection is for. */
  forRep?: string | null;
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

// ── Site inspections: same per-booking pop, but each carries the SALES rep ───

/** One inspector's live row for the celebration: today's job numbers, each tied
 * to the sales rep whose customer the inspection is for. */
export interface InspectorCountRow {
  staffId: string;
  name: string;
  count: number;
  jobs: { code: string; forRep: string | null }[];
}

/**
 * Pure: new site inspections since we last looked. Reuses {@link newBookings}
 * (count-driven, drop-debounced, seeded-silent) over the inspectors' job
 * numbers, then tags each pop as an inspection and attaches the sales rep the
 * job is for — so the celebration can show "<inspector> · #<job> · for <rep>".
 * Mutates `state`.
 */
export function inspectorBookings(
  rows: InspectorCountRow[],
  state: CelebrateState,
  seed: boolean,
): BookingPop[] {
  const codeToRep = new Map<string, string | null>();
  for (const r of rows) for (const j of r.jobs) codeToRep.set(j.code, j.forRep ?? null);
  const base = newBookings(
    rows.map((r) => ({
      staffId: r.staffId,
      name: r.name,
      count: r.count,
      jobCodes: r.jobs.map((j) => j.code),
    })),
    state,
    seed,
  );
  return base.map((p) => ({
    ...p,
    kind: "inspector" as const,
    forRep: p.code ? (codeToRep.get(p.code) ?? null) : null,
  }));
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

/**
 * A wall TV gets tapped once at setup and never touched again. Browsers can
 * still auto-suspend an idle AudioContext later (power saving) with nothing
 * left to resume it — the celebration keeps firing (confetti is independent of
 * audio) but the gong/cheer silently never reach the speakers again. Resuming
 * here needs no fresh user gesture: once a context has been unlocked by a real
 * gesture, browsers allow script-only resume() calls after that. Call once per
 * screen and keep the returned stop function around for unmount.
 */
export function startAudioKeepAlive(intervalMs = 15000): () => void {
  if (typeof window === "undefined") return () => {};
  const id = window.setInterval(() => armAudio(), intervalMs);
  return () => window.clearInterval(id);
}

/**
 * Guard for the top of every play* function: resume() is async, so scheduling
 * oscillator/buffer nodes synchronously right after calling it (against a
 * still-frozen `currentTime`) can silently drop the sound if the context was
 * suspended a beat earlier. If not already running, kick off resume() and
 * retry the whole call once it resolves instead of racing it — cheap since
 * this only ever happens right after an auto-suspend, not on the hot path.
 */
function retryWhenRunning(c: AudioContext, retry: () => void): boolean {
  if (c.state === "running") return false;
  void c.resume().then(() => {
    if (c.state === "running") retry();
  });
  return true;
}

// ── Real recorded crowd cheer (public-domain clip) with a synth fallback ──
/** Public-domain crowd cheer — "Hurray" by starlite, via Wikimedia Commons. */
const APPLAUSE_SRC = "/sounds/cheer.ogg";
let applauseBuf: AudioBuffer | null = null;
let applauseTried = false;

/** Fetch + decode the applause clip into a buffer (once). Safe to call early —
 * decoding works on a suspended context, so it's ready before the first cheer. */
export function preloadApplause(): void {
  const c = getCtx();
  if (!c || applauseBuf || applauseTried) return;
  applauseTried = true;
  fetch(APPLAUSE_SRC)
    .then((r) => r.arrayBuffer())
    .then((ab) => c.decodeAudioData(ab))
    .then((buf) => {
      applauseBuf = buf;
    })
    .catch(() => {
      applauseTried = false; // allow a later retry
    });
}

/**
 * Play the real recorded crowd CHEER for site-inspection celebrations. Falls
 * back to the synth applause only if the clip hasn't finished loading yet (so
 * the very first one is never silent). Plays through the same AudioContext the
 * gong uses, so the one "tap to enable sound" unlock covers it too.
 */
export function playApplause(volume = 1): void {
  const c = getCtx();
  if (!c) return;
  if (retryWhenRunning(c, () => playApplause(volume))) return;
  if (!applauseBuf) {
    preloadApplause();
    playApplauseSynth(); // not ready yet — don't be silent
    return;
  }
  const src = c.createBufferSource();
  src.buffer = applauseBuf;
  const g = c.createGain();
  g.gain.value = volume;
  src.connect(g);
  g.connect(c.destination);
  src.start();
}

/** Play a metallic gong — inharmonic partials + a struck-noise transient. */
export function playGong(volume = 0.55): void {
  const c = getCtx();
  if (!c) return;
  if (retryWhenRunning(c, () => playGong(volume))) return;
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

/**
 * Synthesised applause — the FALLBACK used only until the real recorded clip
 * (loaded by {@link playApplause}) is ready or if it fails to load. Two layers:
 * a swelling brown-noise crowd "roar" plus ~220 sharp clap transients.
 */
function playApplauseSynth(volume = 0.7): void {
  const c = getCtx();
  if (!c) return;
  if (retryWhenRunning(c, () => playApplauseSynth(volume))) return;
  const now = c.currentTime;
  const sr = c.sampleRate;
  const DUR = 3.2;

  const master = c.createGain();
  master.gain.value = volume;
  master.connect(c.destination);

  // Light room delay so the claps aren't bone dry (a hall, not a feedback wash).
  const delay = c.createDelay(0.5);
  delay.delayTime.value = 0.13;
  const feedback = c.createGain();
  feedback.gain.value = 0.22;
  const echoTone = c.createBiquadFilter();
  echoTone.type = "lowpass";
  echoTone.frequency.value = 3200;
  delay.connect(echoTone);
  echoTone.connect(feedback);
  feedback.connect(delay);
  const echoLevel = c.createGain();
  echoLevel.gain.value = 0.35;
  delay.connect(echoLevel);
  echoLevel.connect(master);

  // ── Layer 1: crowd roar — brown noise (random walk) band-passed, swelling. ──
  const bedBuf = c.createBuffer(1, Math.floor(sr * DUR), sr);
  const bd = bedBuf.getChannelData(0);
  let walk = 0;
  for (let i = 0; i < bd.length; i++) {
    walk += (Math.random() * 2 - 1) * 0.05;
    if (walk > 1) walk = 1;
    else if (walk < -1) walk = -1;
    bd[i] = walk * 0.6;
  }
  const bed = c.createBufferSource();
  bed.buffer = bedBuf;
  const bedBp = c.createBiquadFilter();
  bedBp.type = "bandpass";
  bedBp.frequency.value = 950;
  bedBp.Q.value = 0.4;
  const bedGain = c.createGain();
  bedGain.gain.setValueAtTime(0.0001, now);
  bedGain.gain.exponentialRampToValueAtTime(0.4, now + 0.6);
  bedGain.gain.setValueAtTime(0.4, now + DUR - 1.3);
  bedGain.gain.exponentialRampToValueAtTime(0.0001, now + DUR);
  bed.connect(bedBp);
  bedBp.connect(bedGain);
  bedGain.connect(master);
  bed.start(now);
  bed.stop(now + DUR);

  // ── Layer 2: individual claps — short sharp broadband transients. ──
  const clap = (at: number, gain: number) => {
    const len = Math.max(1, Math.floor(sr * 0.012)); // ~12ms
    const buf = c.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); // sharp attack/decay
    }
    const src = c.createBufferSource();
    src.buffer = buf;
    const hp = c.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 900;
    const bp = c.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1300 + Math.random() * 1700; // each hand a touch different
    bp.Q.value = 1.1;
    const g = c.createGain();
    g.gain.value = gain;
    src.connect(hp);
    hp.connect(bp);
    bp.connect(g);
    g.connect(master); // dry
    g.connect(delay); // into the room
    src.start(at);
    src.stop(at + 0.05);
  };

  // ~220 claps spread randomly, swelling in then tailing off — reads as a crowd.
  const claps = 220;
  for (let i = 0; i < claps; i++) {
    const t = Math.random() * DUR;
    const swell = Math.min(1, t / 0.5);
    const fade = Math.max(0, 1 - (t - (DUR - 1.5)) / 1.5);
    const env = swell * Math.max(0.18, fade);
    clap(now + t, (0.16 + Math.random() * 0.2) * env);
  }
}

/**
 * A bright, friendly "ding" — a single bell-like chime (fundamental + fifth +
 * octave + a touch of inharmonic shimmer, fast attack, ringing exponential
 * decay). Used for the site-inspection celebration. Pure synth, works offline.
 */
export function playDing(volume = 0.65): void {
  const c = getCtx();
  if (!c) return;
  if (retryWhenRunning(c, () => playDing(volume))) return;
  const now = c.currentTime;

  const master = c.createGain();
  master.gain.value = volume;
  master.connect(c.destination);

  const base = 1568; // G6 — bright and clear
  const partials = [
    { r: 1, g: 1.0, d: 1.8 },
    { r: 1.5, g: 0.45, d: 1.5 }, // a fifth up
    { r: 2.0, g: 0.28, d: 1.2 }, // octave
    { r: 3.01, g: 0.1, d: 0.9 }, // slight shimmer
  ];
  for (const p of partials) {
    const o = c.createOscillator();
    o.type = "sine";
    o.frequency.value = base * p.r;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(p.g, now + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, now + p.d);
    o.connect(g);
    g.connect(master);
    o.start(now);
    o.stop(now + p.d + 0.05);
  }
}

/**
 * A soft airy "whoosh" — band-passed noise sweeping up in pitch, with a gentle
 * swell. Used as the understated entrance for each rep in the Game Day roll-call
 * (a repeated bell would grate over 15 reps; this just lifts the name in).
 */
export function playWhoosh(volume = 0.3): void {
  const c = getCtx();
  if (!c) return;
  if (retryWhenRunning(c, () => playWhoosh(volume))) return;
  const now = c.currentTime;
  const dur = 0.5;

  const master = c.createGain();
  master.gain.value = volume;
  master.connect(c.destination);

  const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;

  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.Q.value = 0.9;
  bp.frequency.setValueAtTime(280, now);
  bp.frequency.exponentialRampToValueAtTime(2600, now + dur * 0.85);

  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(1, now + 0.13);
  g.gain.exponentialRampToValueAtTime(0.0001, now + dur);

  src.connect(bp);
  bp.connect(g);
  g.connect(master);
  src.start(now);
  src.stop(now + dur);
}

/**
 * A proper cash-register "cha-CHING" — a short metallic noise burst (the drawer
 * "cha") followed by two bright ringing bells (the "ching"). For the roll-call's
 * big earners. Pure synth, works offline.
 */
export function playChaChing(volume = 0.55): void {
  const c = getCtx();
  if (!c) return;
  if (retryWhenRunning(c, () => playChaChing(volume))) return;
  const now = c.currentTime;

  const master = c.createGain();
  master.gain.value = volume;
  master.connect(c.destination);

  // "cha" — a short, bright metallic noise click (the register mechanism).
  const chDur = 0.07;
  const nb = c.createBuffer(1, Math.floor(c.sampleRate * chDur), c.sampleRate);
  const nd = nb.getChannelData(0);
  for (let i = 0; i < nd.length; i++) {
    nd[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / nd.length, 2);
  }
  const noise = c.createBufferSource();
  noise.buffer = nb;
  const nbp = c.createBiquadFilter();
  nbp.type = "bandpass";
  nbp.frequency.value = 2700;
  nbp.Q.value = 0.7;
  const ng = c.createGain();
  ng.gain.value = 0.7;
  noise.connect(nbp);
  nbp.connect(ng);
  ng.connect(master);
  noise.start(now);
  noise.stop(now + chDur);

  // "ching" — two bright bells ringing in quick succession, second up a tone.
  const bell = (at: number, base: number, vol: number) => {
    const partials = [
      { r: 1, g: 1, d: 0.75 },
      { r: 2.0, g: 0.6, d: 0.6 },
      { r: 2.76, g: 0.4, d: 0.5 }, // inharmonic — gives the metallic "bell" sheen
      { r: 5.4, g: 0.16, d: 0.32 },
    ];
    for (const p of partials) {
      const o = c.createOscillator();
      o.type = "sine";
      o.frequency.value = base * p.r;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(p.g * vol, at + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, at + p.d);
      o.connect(g);
      g.connect(master);
      o.start(at);
      o.stop(at + p.d + 0.05);
    }
  };
  bell(now + 0.05, 2349, 1); // D7
  bell(now + 0.15, 2637, 0.9); // E7 — the up-tick that lands the "-ching"
}

/**
 * A short triumphant 3-note rising fanfare — for reps who've already hit Tier 3.
 * Saw waves through a low-pass so it's bright but not harsh.
 */
export function playFanfare(volume = 0.45): void {
  const c = getCtx();
  if (!c) return;
  if (retryWhenRunning(c, () => playFanfare(volume))) return;
  const now = c.currentTime;

  const master = c.createGain();
  master.gain.value = volume;
  master.connect(c.destination);
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 4200;
  lp.connect(master);

  const note = (at: number, freq: number, dur: number) => {
    const o = c.createOscillator();
    o.type = "sawtooth";
    o.frequency.value = freq;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(0.5, at + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g);
    g.connect(lp);
    o.start(at);
    o.stop(at + dur + 0.05);
  };
  note(now, 523, 0.18); // C5
  note(now + 0.12, 659, 0.18); // E5
  note(now + 0.24, 784, 0.5); // G5 (held)
}

const GONG_COLORS = ["#ffd42e", "#fff389", "#f472b6", "#38bdf8", "#f4f1e8"];

/** Gong + a big confetti burst (confetti skipped under reduced-motion). */
export function celebrateGong(): void {
  playGong();
  if (typeof window !== "undefined" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    confetti({ particleCount: 240, spread: 130, startVelocity: 45, origin: { y: 0.5 }, colors: GONG_COLORS });
  }
}
