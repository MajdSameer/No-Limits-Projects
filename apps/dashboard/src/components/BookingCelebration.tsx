"use client";

import confetti from "canvas-confetti";
import { useEffect, useRef, useState } from "react";

import { cx } from "@nlr/ui";

import type { InspectorRowDTO } from "./Board";
import {
  createCelebrateState,
  inspectorBookings,
  newBookings,
  playDing,
  playGong,
  type BookingPop,
  type DailyCountRow,
} from "../lib/celebrate";

/**
 * Live "someone just booked!" moment. When a new booking appears (deduped by
 * MovePro job code, so it fires exactly once even as the polled count bounces),
 * the screen blacks out and the rep's name pops in with the MovePro number
 * underneath, plus a gong and confetti. Site inspections pop the same way but
 * with theatre applause and the sales rep the inspection is for. Multiple
 * bookings queue up and play one after another. Seeded silently on mount so a
 * page load never fires.
 */
const HOLD_MS = 6500; // how long one celebration stays up (matches the long gong)
const FADE_MS = 500; // fade-out tail at the end of HOLD_MS
const GAP_MS = 150; // brief beat between queued celebrations
const MAX_QUEUE = 6; // don't black the wall out for a full minute on a big push

const BURST = ["#ffd42e", "#fff389", "#f472b6", "#38bdf8", "#f4f1e8"];
// Site-inspection celebrations get a neon-green burst to match their boxes.
const INSPECTOR_BURST = ["#4ade80", "#22c55e", "#86efac", "#bbf7d0", "#f4f1e8"];

function reducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function BookingCelebration({
  daily,
  inspectors,
}: {
  daily: DailyCountRow[];
  inspectors?: InspectorRowDTO[];
}) {
  const state = useRef(createCelebrateState());
  const seeded = useRef(false);
  const inspState = useRef(createCelebrateState());
  const inspSeeded = useRef(false);
  const queue = useRef<BookingPop[]>([]);
  const running = useRef(false);
  const timers = useRef<number[]>([]);
  const [active, setActive] = useState<{ pop: BookingPop; out: boolean } | null>(null);

  useEffect(() => {
    const pops: BookingPop[] = [];

    if (daily.length > 0) {
      pops.push(...newBookings(daily, state.current, !seeded.current));
      seeded.current = true;
    }

    if (inspectors && inspectors.length > 0) {
      const rows = inspectors.map((i) => ({
        staffId: i.id,
        name: i.name,
        count: i.count,
        jobs: i.jobs,
      }));
      pops.push(...inspectorBookings(rows, inspState.current, !inspSeeded.current));
      inspSeeded.current = true;
    }

    if (pops.length === 0) return;
    for (const p of pops) {
      if (queue.current.length < MAX_QUEUE) queue.current.push(p);
    }
    drain();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [daily, inspectors]);

  // Clear any pending timers on unmount.
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  function drain() {
    if (running.current) return;
    const next = queue.current.shift();
    if (!next) return;
    running.current = true;
    setActive({ pop: next, out: false });
    const isInspector = next.kind === "inspector";
    if (isInspector) playDing();
    else playGong();
    if (!reducedMotion()) {
      const colors = isInspector ? INSPECTOR_BURST : BURST;
      confetti({ particleCount: 160, spread: 110, startVelocity: 45, origin: { y: 0.5 }, colors });
      timers.current.push(
        window.setTimeout(
          () => confetti({ particleCount: 90, angle: 60, spread: 70, origin: { x: 0, y: 0.7 }, colors }),
          250,
        ),
        window.setTimeout(
          () => confetti({ particleCount: 90, angle: 120, spread: 70, origin: { x: 1, y: 0.7 }, colors }),
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
  const isInspector = pop.kind === "inspector";

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
        className={cx(
          "nl-glow pointer-events-none absolute inset-0",
          isInspector
            ? "[background:radial-gradient(60%_60%_at_50%_45%,rgba(74,222,128,0.24),transparent_70%)]"
            : "[background:radial-gradient(60%_60%_at_50%_45%,rgba(255,212,46,0.22),transparent_70%)]",
        )}
      />
      <p
        className={cx(
          "nl-pop relative font-mono text-sm font-bold tracking-[0.45em] uppercase sm:text-lg",
          isInspector ? "text-green-300" : "text-accent-400",
        )}
      >
        {isInspector ? "Site inspection" : "New booking"}
      </p>
      <p className="nl-pop-lg font-display relative leading-none font-black text-white uppercase [font-size:clamp(3rem,13vw,9rem)]">
        {pop.name}
      </p>
      {pop.code && (
        <div
          className={cx(
            "nl-rise relative rounded-2xl border-2 bg-black/40 px-7 py-3",
            isInspector
              ? "border-green-400/70 shadow-[0_0_40px_-8px_rgba(74,222,128,0.5)]"
              : "border-accent-400/70 shadow-[0_0_40px_-8px_rgba(255,212,46,0.5)]",
          )}
        >
          <span
            className={cx(
              "block font-mono text-[0.6rem] tracking-[0.35em] uppercase sm:text-xs",
              isInspector ? "text-green-200/80" : "text-accent-200/80",
            )}
          >
            MovePro
          </span>
          <span
            className={cx(
              "font-mono font-bold tracking-[0.25em] [font-size:clamp(1.3rem,4.5vw,2.6rem)]",
              isInspector ? "text-green-200" : "text-accent-300",
            )}
          >
            #{pop.code}
          </span>
        </div>
      )}
      {isInspector && pop.forRep && (
        <p className="nl-rise relative font-display text-2xl font-bold text-white/80 sm:text-3xl">
          for <span className="text-green-300">{pop.forRep}</span>
        </p>
      )}
    </div>
  );
}
