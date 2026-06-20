"use client";

import confetti from "canvas-confetti";
import { useEffect, useRef, useState } from "react";

import { cx } from "@nlr/ui";

import { newBookings, playGong, type BookingPop, type DailyCountRow } from "../lib/celebrate";

/**
 * Live "someone just booked!" moment. When a new booking appears (deduped by
 * MovePro job code, so it fires exactly once even as the polled count bounces),
 * the screen blacks out and the rep's name pops in with the MovePro number
 * underneath, plus a gong and confetti. Multiple bookings queue up and play one
 * after another. Seeded silently on mount so a page load never fires.
 */
const HOLD_MS = 6500; // how long one celebration stays up (matches the long gong)
const FADE_MS = 500; // fade-out tail at the end of HOLD_MS
const GAP_MS = 150; // brief beat between queued celebrations
const MAX_QUEUE = 6; // don't black the wall out for a full minute on a big push

const BURST = ["#ffd42e", "#fff389", "#f472b6", "#38bdf8", "#f4f1e8"];

function reducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function BookingCelebration({ daily }: { daily: DailyCountRow[] }) {
  const seenCodes = useRef<Set<string>>(new Set());
  const seenCount = useRef<Map<string, number>>(new Map());
  const seeded = useRef(false);
  const queue = useRef<BookingPop[]>([]);
  const running = useRef(false);
  const timers = useRef<number[]>([]);
  const [active, setActive] = useState<{ pop: BookingPop; out: boolean } | null>(null);

  useEffect(() => {
    if (daily.length === 0) return; // ignore the empty cold-DB fallback
    const pops = newBookings(daily, seenCodes.current, seenCount.current, !seeded.current);
    seeded.current = true;
    if (pops.length === 0) return;
    for (const p of pops) {
      if (queue.current.length < MAX_QUEUE) queue.current.push(p);
    }
    drain();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [daily]);

  // Clear any pending timers on unmount.
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  function drain() {
    if (running.current) return;
    const next = queue.current.shift();
    if (!next) return;
    running.current = true;
    setActive({ pop: next, out: false });
    playGong();
    if (!reducedMotion()) {
      confetti({ particleCount: 160, spread: 110, startVelocity: 45, origin: { y: 0.5 }, colors: BURST });
      timers.current.push(
        window.setTimeout(
          () => confetti({ particleCount: 90, angle: 60, spread: 70, origin: { x: 0, y: 0.7 }, colors: BURST }),
          250,
        ),
        window.setTimeout(
          () => confetti({ particleCount: 90, angle: 120, spread: 70, origin: { x: 1, y: 0.7 }, colors: BURST }),
          250,
        ),
      );
    }
    // Start fading the whole overlay out near the end, then unmount + go next.
    timers.current.push(
      window.setTimeout(() => setActive((a) => (a ? { ...a, out: true } : a)), HOLD_MS - FADE_MS),
    );
    timers.current.push(
      window.setTimeout(() => {
        setActive(null);
        running.current = false;
        timers.current.push(window.setTimeout(drain, GAP_MS));
      }, HOLD_MS),
    );
  }

  if (!active) return null;
  const { pop, out } = active;

  return (
    <div
      role="status"
      aria-live="assertive"
      className={cx(
        "fixed inset-0 z-[100] flex flex-col items-center justify-center gap-7 overflow-hidden bg-ink-950 px-6 text-center",
        out ? "nl-overlay-out" : "nl-overlay-in",
      )}
    >
      <div
        aria-hidden
        className="nl-glow pointer-events-none absolute inset-0 [background:radial-gradient(60%_60%_at_50%_45%,rgba(255,212,46,0.22),transparent_70%)]"
      />
      <p className="nl-pop relative font-mono text-sm font-bold tracking-[0.45em] text-accent-400 uppercase sm:text-lg">
        New booking
      </p>
      <p className="nl-pop-lg font-display relative leading-none font-black text-white uppercase [font-size:clamp(3rem,13vw,9rem)]">
        {pop.name}
      </p>
      {pop.code && (
        <div className="nl-rise relative rounded-2xl border-2 border-accent-400/70 bg-black/40 px-7 py-3 shadow-[0_0_40px_-8px_rgba(255,212,46,0.5)]">
          <span className="block font-mono text-[0.6rem] tracking-[0.35em] text-accent-200/80 uppercase sm:text-xs">
            MovePro
          </span>
          <span className="font-mono font-bold tracking-[0.25em] text-accent-300 [font-size:clamp(1.3rem,4.5vw,2.6rem)]">
            #{pop.code}
          </span>
        </div>
      )}
    </div>
  );
}
