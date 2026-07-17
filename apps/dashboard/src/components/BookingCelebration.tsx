"use client";

import confetti from "canvas-confetti";
import { useEffect, useRef, useState } from "react";

import { cx } from "@nlr/ui";

import type { InspectorRowDTO } from "./Board";
import {
  createCelebrateState,
  inspectorBookings,
  newBookings,
  playGong,
  type BookingPop,
  type DailyCountRow,
} from "../lib/celebrate";

/**
 * Live "someone just booked!" moment. When a new booking appears (deduped by
 * MovePro job code, so it fires exactly once even as the polled count bounces),
 * the screen blacks out and the rep's name pops in with the MovePro number
 * underneath, plus a gong and confetti. Site inspections pop the same way (same
 * gong) but with a green burst and the sales rep the inspection is for. Multiple
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

// Game Day goal celebrations — mirrors GameDayWall's Spain/Argentina palette so
// the confetti and glow match the scoring rep's team.
const GOAL_TEAM = {
  orange: {
    rgb: "198, 11, 30",
    burst: ["#c60b1e", "#ffc400", "#ff5468", "#fff7d6"],
    text: "text-[#ffc400]",
    border: "border-[#c60b1e]/70",
    shadow: "shadow-[0_0_40px_-8px_rgba(198,11,30,0.5)]",
    small: "text-[#ffe3ad]/90",
    big: "text-[#ffc400]",
  },
  blue: {
    rgb: "117, 170, 219",
    burst: ["#75aadb", "#ffffff", "#9cc4e4", "#eef7ff"],
    text: "text-[#75aadb]",
    border: "border-[#75aadb]/70",
    shadow: "shadow-[0_0_40px_-8px_rgba(117,170,219,0.5)]",
    small: "text-[#bfe0ff]/90",
    big: "text-[#9cc4e4]",
  },
};

function reducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function BookingCelebration({
  daily,
  inspectors,
  gameDay = false,
}: {
  daily: DailyCountRow[];
  inspectors?: InspectorRowDTO[];
  /** Game Day only: swaps the "new booking" beat for a goal celebration
   * (net-flash + "GOOOOAL" sweep, team-coloured confetti). Everywhere else
   * (outside Game Day) the gong, timing, and visuals are unchanged. */
  gameDay?: boolean;
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
    playGong();
    if (!reducedMotion()) {
      const goalTeam =
        gameDay && next.kind !== "inspector" && (next.team === "orange" || next.team === "blue")
          ? next.team
          : null;
      const colors = next.kind === "inspector" ? INSPECTOR_BURST : goalTeam ? GOAL_TEAM[goalTeam].burst : BURST;
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
  // Game Day: swap the "new booking" moment for a goal beat, recoloured to the
  // scoring rep's team. Untouched outside Game Day and for site inspections.
  const isGoal = gameDay && !isInspector;
  const goalTeam = isGoal && (pop.team === "orange" || pop.team === "blue") ? pop.team : null;
  const codeTheme = isInspector
    ? {
        border: "border-green-400/70",
        shadow: "shadow-[0_0_40px_-8px_rgba(74,222,128,0.5)]",
        small: "text-green-200/80",
        big: "text-green-200",
      }
    : goalTeam
      ? GOAL_TEAM[goalTeam]
      : {
          border: "border-accent-400/70",
          shadow: "shadow-[0_0_40px_-8px_rgba(255,212,46,0.5)]",
          small: "text-accent-200/80",
          big: "text-accent-300",
        };
  const theme = isInspector
    ? {
        glow: "[background:radial-gradient(60%_60%_at_50%_45%,rgba(74,222,128,0.24),transparent_70%)]",
        label: "Site inspection",
        labelColor: "text-green-300",
      }
    : isGoal
      ? {
          glow: goalTeam
            ? `[background:radial-gradient(60%_60%_at_50%_45%,rgba(${GOAL_TEAM[goalTeam].rgb},0.24),transparent_70%)]`
            : "[background:radial-gradient(60%_60%_at_50%_45%,rgba(255,212,46,0.22),transparent_70%)]",
          label: "Goal!",
          labelColor: goalTeam ? GOAL_TEAM[goalTeam].text : "text-accent-400",
        }
      : {
          glow: "[background:radial-gradient(60%_60%_at_50%_45%,rgba(255,212,46,0.22),transparent_70%)]",
          label: "New booking",
          labelColor: "text-accent-400",
        };

  return (
    <div
      role="status"
      aria-live="assertive"
      className={cx(
        "fixed inset-0 z-[100] flex flex-col items-center justify-center gap-7 overflow-hidden bg-ink-950 px-6 text-center",
        out ? "nl-overlay-out" : "nl-overlay-in",
      )}
    >
      <div aria-hidden className={cx("nl-glow pointer-events-none absolute inset-0", theme.glow)} />
      {isGoal && !reducedMotion() && (
        <>
          <div
            aria-hidden
            className="gd-goal-flash pointer-events-none absolute inset-0 z-10"
            style={{
              background: `radial-gradient(circle at 50% 45%, rgba(${goalTeam ? GOAL_TEAM[goalTeam].rgb : "255, 212, 46"}, 0.55), transparent 70%)`,
            }}
          />
          <p
            aria-hidden
            className="gd-goal-sweep font-display pointer-events-none absolute inset-x-0 top-1/2 z-20 -translate-y-1/2 text-center leading-none font-black uppercase [font-size:clamp(3.5rem,16vw,13rem)]"
            style={{
              color: goalTeam === "orange" ? "#ffc400" : goalTeam === "blue" ? "#75aadb" : "#ffd42e",
              WebkitTextStroke: goalTeam === "orange" ? "3px #c60b1e" : goalTeam === "blue" ? "3px #ffffff" : undefined,
            }}
          >
            GOOOOAL
          </p>
        </>
      )}
      <p
        className={cx(
          "nl-pop relative font-mono text-sm font-bold tracking-[0.45em] uppercase sm:text-lg",
          theme.labelColor,
        )}
      >
        {theme.label}
      </p>
      <p className="nl-pop-lg font-display relative leading-none font-black text-white uppercase [font-size:clamp(3rem,13vw,9rem)]">
        {pop.name}
      </p>
      {pop.code && (
        <div className={cx("nl-rise relative rounded-2xl border-2 bg-black/40 px-7 py-3", codeTheme.border, codeTheme.shadow)}>
          <span className={cx("block font-mono text-[0.6rem] tracking-[0.35em] uppercase sm:text-xs", codeTheme.small)}>
            MovePro
          </span>
          <span className={cx("font-mono font-bold tracking-[0.25em] [font-size:clamp(1.3rem,4.5vw,2.6rem)]", codeTheme.big)}>
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
