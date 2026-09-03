"use client";

import confetti from "canvas-confetti";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { cx } from "@nlr/ui";

import type { BoardRowDTO, BoardsDTO, InspectorRowDTO } from "./Board";
import { BookingCelebration } from "./BookingCelebration";
import {
  armAudio,
  audioRunning,
  playApplause,
  playChaChing,
  playDing,
  playFanfare,
  playGong,
  playWhoosh,
} from "../lib/celebrate";
import {
  FINAL_PUSH_TIERS,
  buildFacts,
  buildRoster,
  countdownPhase,
  countIncreases,
  formatCountdown,
  leadLine,
  milestoneCrossed,
  overMoney,
  rankRows,
  scoreState,
  secsUntilGameEnd,
  taglineFor,
  takesLeadLine,
  type RosterCard,
  type Side,
} from "../lib/game-day";
import { useLiveRefresh } from "../lib/live";
import { tierProgress } from "../lib/tiers";

/**
 * Full-screen "Game Day" wall for /live/game-day — an esports-style GREEN vs
 * PURPLE sales battle built to sit on the office TV all day at 1920×1080
 * without scrolling. Header (title + countdown/rewards bar), a big matchup
 * banner (hex badges, huge live totals, breathing VS, dynamic lead line), two
 * row-based leaderboards (avatar, thin progress bar scaled to the board's max,
 * gold crown on the overall top scorer) and a rewards footer.
 *
 * It stays alive between bookings with very slow ambient glows, faint specks
 * around the VS and a light sweep across the banner, and REACTS when the data
 * moves: a booking flashes the rep's row in their team colour, swaps the
 * number, eases the bar, shows "+1 BOOKING", pulses the team total, and FLIP-
 * slides rows into their new rank; a lead change sweeps the new leader's
 * colour across its half of the banner with "X TAKES THE LEAD!"; ties pulse
 * gold with "⚡ GAME TIED"; team milestones and a new overall #1 get a toast.
 *
 * Everything that isn't visual is unchanged from the previous wall: the
 * opening roll-call ceremony (music, whoosh/cha-ching/fanfare per rep, "LET
 * THE GAMES BEGIN"), the 1-second countdown to 7 PM with the final-push gong
 * tiers, periodic fun facts, the shared BookingCelebration gong beat, the
 * manager-picked top-revenue job, /api/boards polling, and the audio keep-
 * alive for a TV nobody clicks. Scoring semantics live in lib/game-day.ts and
 * are mirrored by db/queries/game-day-results.ts for the nightly archive.
 */

// Prize money — edit these to change what's on the line. TOP_SCORER_PRIZE and
// TEAM_PRIZE are hand-mirrored in db/queries/game-day-results.ts.
const TOP_SCORER_PRIZE = 50; // day's single highest individual scorer (most bookings)
const JOB_REVENUE_PRIZE = 50; // highest-revenue single job booked today
const TEAM_PRIZE = 50; // every member of the winning team

// Roll-call thresholds.
const MONEY_THRESHOLD = 80000; // revenue ($) that earns the cha-ching + money splash

// Periodic scoreboard "fun facts".
const FACT_INTERVAL_MS = 30 * 60 * 1000;
const FACT_HOLD_MS = 9000;

// Event timing (ms).
const TOAST_MS = 2600; // lead change / tie / milestone / new #1 toasts
const EVENT_MS = 1800; // row flash + "+1 BOOKING" tag lifetime

// Ceremony timing (ms).
const TITLE_MS = 3500;
const ROSTER_TOTAL_MS = 44000; // the rep roll-call lasts EXACTLY this long
const GO_MS = 3000;
const FADE_MS = 550;

// Background hype anthem for the roll-call (in public/sounds). 57s, longer
// than the 44s roll-call window, so it never runs dry.
const MUSIC_SRC = "/sounds/f1-opening-titles-2026.mp3";
const MUSIC_VOL = 0.55;

/** Visual identity per data key. Keys stay "orange"/"blue" (DB values) — only
 * the look is Green/Purple. BookingCelebration.tsx's GOAL_TEAM mirrors these. */
const TEAM: Record<
  Side,
  { label: string; cls: string; hex: string; dark: string; rgb: string; burst: string[]; dir: 1 | -1 }
> = {
  orange: {
    label: "Green",
    cls: "gd-t-green",
    hex: "#b7ff00",
    dark: "#648c00",
    rgb: "183, 255, 0",
    burst: ["#b7ff00", "#648c00", "#e2ff80", "#ffffff"],
    dir: 1,
  },
  blue: {
    label: "Purple",
    cls: "gd-t-purple",
    hex: "#b84dff",
    dark: "#6522a6",
    rgb: "184, 77, 255",
    burst: ["#b84dff", "#6522a6", "#d9a6ff", "#ffffff"],
    dir: -1,
  },
};
const LABELS: Record<Side, string> = { orange: TEAM.orange.label, blue: TEAM.blue.label };
const GOLD_BURST = ["#ffc928", "#ffe08a", "#ffffff", "#b7ff00", "#b84dff"];

function reducedMotion(): boolean {
  return (
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

// Money-emoji confetti shapes, built once on first use (needs the browser).
type ConfettiShape = ReturnType<typeof confetti.shapeFromText>;
let moneyShapes: ConfettiShape[] | null = null;

/** A splash of cash — money emojis burst up from the floor. Big earners only. */
function moneySplash(): void {
  if (reducedMotion()) return;
  if (moneyShapes === null) {
    try {
      moneyShapes = ["💵", "💰", "🤑", "💸"].map((text) => confetti.shapeFromText({ text, scalar: 3 }));
    } catch {
      moneyShapes = [];
    }
  }
  const base = moneyShapes.length ? { shapes: moneyShapes, scalar: 3 } : {};
  confetti({ particleCount: 26, spread: 75, startVelocity: 38, origin: { y: 0.62 }, ticks: 220, ...base });
  confetti({ particleCount: 12, angle: 60, spread: 55, origin: { x: 0.08, y: 0.7 }, ticks: 200, ...base });
  confetti({ particleCount: 12, angle: 120, spread: 55, origin: { x: 0.92, y: 0.7 }, ticks: 200, ...base });
}

// Deterministic speck field around the VS — seeded by index (not Math.random)
// so server and client render identical positions (no hydration mismatch).
const VS_SPECKS = Array.from({ length: 14 }, (_, i) => ({
  side: (i % 2 === 0 ? "orange" : "blue") as Side,
  left: 38 + ((i * 29) % 24), // 38%..62% — hugging the centre
  top: 10 + ((i * 41) % 80),
  dx: ((i * 13) % 18) - 9,
  delay: (i * 1.9) % 12,
  dur: 10 + (i % 5) * 2,
  size: 2 + (i % 3),
  alpha: 0.25 + (i % 4) * 0.1,
}));

/** Ambient arena: a slow-drifting glow blob behind each half (the leading
 * side's is brighter), the centre kept mostly black. Decorative only. */
function Backdrop({ leader }: { leader: Side | null }) {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-30 overflow-hidden bg-[var(--bg)]">
      {(["orange", "blue"] as const).map((side) => {
        const t = TEAM[side];
        const lead = leader === side;
        return (
          <div
            key={side}
            className={cx(
              "gd-ambient absolute inset-y-[-10%] w-[55%] transition-opacity duration-700",
              side === "orange" ? "left-[-12%]" : "right-[-12%]",
            )}
            style={{
              opacity: lead ? 1 : 0.55,
              background: `radial-gradient(60% 55% at ${side === "orange" ? "35%" : "65%"} 45%, rgba(${t.rgb}, ${lead ? 0.2 : 0.13}), transparent 70%)`,
            }}
          />
        );
      })}
      {/* Extremely subtle texture so the black never reads flat. */}
      <div
        className="absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.9) 0.6px, transparent 0.8px)",
          backgroundSize: "26px 26px",
        }}
      />
    </div>
  );
}

/** Live countdown to the 7 PM final whistle. Final hour reads slightly urgent
 * (gold), final 10 minutes get a subtle pulse; never a constant flash. */
function Countdown({ secs }: { secs: number | null }) {
  if (secs === null) return null; // computed in the parent; render only after mount
  const phase = countdownPhase(secs);
  const over = phase === "over";
  return (
    <div
      className={cx(
        "flex items-center gap-3 rounded-xl border px-4 py-2",
        over
          ? "border-[var(--border)] bg-white/[0.03]"
          : phase === "final10"
            ? "gd-timer-pulse border-[var(--gold)] bg-[rgba(255,201,40,0.08)]"
            : phase === "finalHour"
              ? "border-[rgba(255,201,40,0.55)] bg-[rgba(255,201,40,0.05)]"
              : "border-[var(--border)] bg-white/[0.03]",
      )}
    >
      <span
        aria-hidden
        className={cx(
          "grid size-8 shrink-0 place-items-center rounded-full border",
          over ? "border-white/20 text-white/60" : "border-[var(--green)]/70 text-[var(--green)]",
        )}
      >
        {over ? "🏁" : "⏱"}
      </span>
      <div className="flex flex-col leading-none">
        {over ? (
          <span className="font-display text-xl font-black tracking-wide text-white/75 uppercase">Full time</span>
        ) : (
          <>
            <span
              className={cx(
                "font-display font-black tabular-nums [font-size:clamp(1.3rem,1.7vw,2rem)]",
                phase === "normal" ? "text-white" : "text-[var(--gold)]",
              )}
            >
              {formatCountdown(secs)}
            </span>
            <span className="mt-1 text-[0.62rem] font-bold tracking-[0.18em] text-[var(--muted)] uppercase">
              Left · ends 7 PM
            </span>
          </>
        )}
      </div>
    </div>
  );
}

/** One reward item in the header bar / footer. */
function Reward({
  icon,
  label,
  value,
  tone,
  sub,
}: {
  icon: string;
  label: string;
  value: string;
  tone: "green" | "purple" | "gold";
  sub?: string;
}) {
  const color = tone === "green" ? "var(--green)" : tone === "purple" ? "var(--purple)" : "var(--gold)";
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span
        aria-hidden
        className="grid size-9 shrink-0 place-items-center rounded-lg border text-lg"
        style={{ borderColor: `color-mix(in srgb, ${color} 45%, transparent)`, color }}
      >
        {icon}
      </span>
      <div className="flex min-w-0 flex-col leading-none">
        <span className="text-[0.62rem] font-bold tracking-[0.18em] whitespace-nowrap text-[var(--muted)] uppercase">
          {label}
        </span>
        <span
          className="font-display mt-1 truncate font-black tracking-wide uppercase [font-size:clamp(1rem,1.25vw,1.5rem)]"
          style={{ color }}
        >
          {value}
        </span>
        {sub && <span className="mt-0.5 truncate text-[0.7rem] font-semibold text-white/60">{sub}</span>}
      </div>
    </div>
  );
}

/** Hexagonal team badge with a simple CSS/SVG glyph — no illustrations. */
function TeamBadge({ side, lead }: { side: Side; lead: boolean }) {
  const t = TEAM[side];
  const hex = "polygon(25% 3%, 75% 3%, 97% 50%, 75% 97%, 25% 97%, 3% 50%)";
  return (
    <div
      aria-hidden
      className="relative shrink-0 transition-[filter] duration-700 [width:clamp(4.2rem,6.2vw,7rem)] [aspect-ratio:1]"
      style={{ filter: `drop-shadow(0 0 ${lead ? 18 : 10}px rgba(${t.rgb}, ${lead ? 0.7 : 0.4}))` }}
    >
      <div className="absolute inset-0" style={{ clipPath: hex, background: t.hex }} />
      <div className="absolute inset-[3px]" style={{ clipPath: hex, background: "var(--panel)" }} />
      <div className="absolute inset-0 grid place-items-center">
        {side === "orange" ? (
          <svg viewBox="0 0 24 24" className="size-[46%]" fill={t.hex}>
            <path d="M13 2 4 14h6l-1 8 9-12h-6z" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="size-[46%]" fill={t.hex}>
            <path d="M12 2 3 7v6c0 5 4 8.5 9 9 5-.5 9-4 9-9V7zm0 4 5 3v4c0 3-2.5 5.5-5 6-2.5-.5-5-3-5-6V9z" />
          </svg>
        )}
      </div>
    </div>
  );
}

/** One half of the matchup banner: badge · team name · huge live total. */
function MatchupSide({ side, total, lead, pulseKey }: { side: Side; total: number; lead: boolean; pulseKey: number }) {
  const t = TEAM[side];
  const left = side === "orange";
  return (
    <div
      className={cx(
        t.cls,
        "relative flex min-w-0 flex-1 items-center gap-5 px-5 py-3",
        left ? "flex-row" : "flex-row-reverse",
      )}
    >
      {/* Leading side gets stronger illumination (eases in/out). */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 transition-opacity duration-700"
        style={{
          opacity: lead ? 1 : 0.35,
          background: `linear-gradient(${left ? "90deg" : "270deg"}, rgba(${t.rgb}, 0.16), rgba(${t.rgb}, 0.04) 55%, transparent)`,
        }}
      />
      <TeamBadge side={side} lead={lead} />
      <div className={cx("relative flex min-w-0 flex-1 flex-col", left ? "items-start" : "items-end")}>
        <span
          className="font-display font-black tracking-[0.12em] uppercase [font-size:clamp(0.9rem,1.3vw,1.5rem)]"
          style={{ color: t.hex }}
        >
          {t.label} team
        </span>
        <span
          key={`${total}-${pulseKey}`}
          className="gd-bump font-display leading-none font-black tabular-nums text-white [font-size:clamp(3.2rem,6vw,6.5rem)]"
          style={{ textShadow: lead ? `0 0 28px rgba(${t.rgb}, 0.55)` : "none" }}
        >
          {total}
        </span>
      </div>
    </div>
  );
}

interface RowEvent {
  key: number;
  delta: number;
}

/** One player row: rank · avatar · name (+1 tag) · progress · bookings. */
function Row({
  r,
  side,
  rank,
  max,
  isTop,
  isTopJob,
  crownKey,
  event,
}: {
  r: BoardRowDTO;
  side: Side;
  rank: number;
  max: number;
  isTop: boolean;
  isTopJob: boolean;
  crownKey: number;
  event: RowEvent | undefined;
}) {
  const t = TEAM[side];
  const pct = max > 0 ? Math.round((r.count / max) * 100) : 0;
  return (
    <li
      data-id={r.staffId}
      className={cx(
        "relative flex min-h-0 items-center gap-3 rounded-lg border px-3",
        "border-[var(--border)] bg-white/[0.025]",
        isTop && "gd-top-row",
      )}
    >
      {/* One-shot team-colour flash on a new booking (re-keyed per event). */}
      {event && <span key={event.key} aria-hidden className="gd-row-flash pointer-events-none absolute inset-0 rounded-lg" />}

      {/* Rank — the overall #1 wears the crown. */}
      <span
        className={cx(
          "grid size-7 shrink-0 place-items-center rounded-md border font-mono text-xs font-black tabular-nums",
          isTop ? "border-[var(--gold)]/70 text-[var(--gold)]" : "border-white/15 text-white/70",
        )}
        style={{ borderColor: isTop ? undefined : `rgba(${t.rgb}, 0.45)` }}
      >
        {isTop ? (
          <span key={crownKey} className="gd-crown-in gd-crown-glow text-sm leading-none">
            👑
          </span>
        ) : (
          rank
        )}
      </span>

      {/* Avatar — circle with the initial. */}
      <span
        aria-hidden
        className="grid size-7 shrink-0 place-items-center rounded-full font-display text-sm font-black"
        style={{ background: t.hex, color: "#050607" }}
      >
        {r.name.trim().charAt(0).toUpperCase()}
      </span>

      {/* Name + optional pills. */}
      <span className="relative flex min-w-0 flex-[1.1] items-center gap-2">
        <span
          className={cx(
            "truncate font-display font-black tracking-wide uppercase [font-size:clamp(0.85rem,1.05vw,1.2rem)]",
            isTop ? "text-white" : "text-white/90",
          )}
        >
          {r.name}
        </span>
        {isTopJob && (
          <span className="shrink-0 rounded-sm border border-[var(--gold)]/60 px-1.5 py-0.5 text-[0.55rem] font-black tracking-wider text-[var(--gold)] uppercase">
            💼 Top job
          </span>
        )}
        {event && event.delta > 0 && (
          <span
            key={event.key}
            className="gd-plus-tag shrink-0 rounded-sm px-1.5 py-0.5 text-[0.6rem] font-black tracking-wider uppercase"
            style={{ background: `rgba(${t.rgb}, 0.18)`, color: t.hex, border: `1px solid rgba(${t.rgb}, 0.6)` }}
          >
            +{event.delta} booking{event.delta === 1 ? "" : "s"}
          </span>
        )}
      </span>

      {/* Progress — thin bar scaled to the board-wide max; dark track at 0. */}
      <span aria-hidden className="relative h-1.5 flex-[1.6] overflow-hidden rounded-full bg-white/[0.07]">
        <span
          className="gd-bar-fill absolute inset-y-0 left-0 rounded-full"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${t.dark}, ${t.hex})`,
            boxShadow: r.count > 0 ? `0 0 10px rgba(${t.rgb}, 0.6)` : "none",
          }}
        />
      </span>

      {/* Bookings — re-keyed so the number swaps with a scale/fade. */}
      <span
        key={r.count}
        className={cx(
          "gd-num-swap w-[5.5rem] shrink-0 text-right font-display leading-none font-black tabular-nums [font-size:clamp(1.1rem,1.4vw,1.7rem)]",
          isTop ? "text-[var(--gold)]" : "text-white",
        )}
      >
        {r.count}
      </span>
    </li>
  );
}

/** A team's leaderboard panel. Rows FLIP-slide into new ranks on reorder. */
function TeamPanel({
  side,
  reps,
  total,
  lead,
  boardMax,
  topIds,
  topJobId,
  crownKey,
  events,
  totalPulse,
}: {
  side: Side;
  reps: BoardRowDTO[];
  total: number;
  lead: boolean;
  boardMax: number;
  topIds: Set<string>;
  topJobId: string | null;
  crownKey: number;
  events: ReadonlyMap<string, RowEvent>;
  totalPulse: number;
}) {
  const t = TEAM[side];
  const sorted = rankRows(reps);
  const listRef = useRef<HTMLUListElement | null>(null);
  const rects = useRef(new Map<string, DOMRect>());
  const orderKey = sorted.map((r) => r.staffId).join("|");

  // FLIP: remember where each row was, and after a reorder start it at its
  // old offset and let the CSS transition slide it into place.
  useLayoutEffect(() => {
    const ul = listRef.current;
    if (!ul) return;
    const items = Array.from(ul.querySelectorAll<HTMLElement>("[data-id]"));
    const next = new Map<string, DOMRect>();
    for (const el of items) next.set(el.dataset.id ?? "", el.getBoundingClientRect());
    if (!reducedMotion()) {
      for (const el of items) {
        const id = el.dataset.id ?? "";
        const prev = rects.current.get(id);
        const now = next.get(id);
        if (!prev || !now) continue;
        const dy = prev.top - now.top;
        if (Math.abs(dy) < 1) continue;
        el.classList.remove("gd-flip-move");
        el.style.transform = `translateY(${dy}px)`;
        void el.offsetHeight; // commit the start position before transitioning
        el.classList.add("gd-flip-move");
        el.style.transform = "";
      }
    }
    rects.current = next;
  }, [orderKey]);

  return (
    <section
      className={cx(
        t.cls,
        "gd-panel relative flex min-h-0 flex-col overflow-hidden rounded-xl transition-shadow duration-700",
      )}
      style={{
        borderColor: lead ? `rgba(${t.rgb}, 0.55)` : `rgba(${t.rgb}, 0.28)`,
        boxShadow: lead ? `0 0 34px -10px rgba(${t.rgb}, 0.55)` : `0 0 0 0 rgba(${t.rgb}, 0)`,
      }}
    >
      {/* Faint radial lighting behind the panel. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: `radial-gradient(70% 40% at 50% 0%, rgba(${t.rgb}, 0.07), transparent 70%)` }}
      />
      <header className="relative flex shrink-0 items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <span aria-hidden className="text-lg" style={{ color: t.hex }}>
            ⬢
          </span>
          <h2
            className="font-display font-black tracking-[0.08em] uppercase [font-size:clamp(1rem,1.3vw,1.5rem)]"
            style={{ color: t.hex }}
          >
            {t.label} team
          </h2>
        </div>
        <div className="flex items-center gap-3 text-[0.68rem] font-bold tracking-[0.14em] text-[var(--muted)] uppercase">
          <span>
            {reps.length} player{reps.length === 1 ? "" : "s"}
          </span>
          <span aria-hidden className="h-4 w-px bg-[var(--border)]" />
          <span className="flex items-center gap-2">
            Total bookings
            <span
              key={`${total}-${totalPulse}`}
              className="gd-bump grid min-w-7 place-items-center rounded-full px-2 py-0.5 font-display text-sm font-black tabular-nums"
              style={{ background: t.hex, color: "#050607" }}
            >
              {total}
            </span>
          </span>
        </div>
      </header>

      <div className="relative grid shrink-0 grid-cols-[1.75rem_1.75rem_1.1fr_1.6fr_5.5rem] items-center gap-3 px-6 pt-2 pb-1 text-[0.6rem] font-bold tracking-[0.16em] text-[var(--muted)] uppercase">
        <span>Rank</span>
        <span />
        <span>Player</span>
        <span />
        <span className="text-right">Bookings</span>
      </div>

      {sorted.length === 0 ? (
        <div className="relative m-3 grid flex-1 place-items-center rounded-lg border border-dashed border-[var(--border)] p-4 text-center">
          <p className="text-sm font-medium text-white/40">No {t.label} players yet — assign them in Manage.</p>
        </div>
      ) : (
        <ul ref={listRef} className="relative grid min-h-0 flex-1 gap-1.5 px-3 pb-3 [grid-auto-rows:minmax(0,1fr)]">
          {sorted.map((r, i) => (
            <Row
              key={r.staffId}
              r={r}
              side={side}
              rank={i + 1}
              max={boardMax}
              isTop={topIds.has(r.staffId)}
              isTopJob={r.staffId === topJobId}
              crownKey={crownKey}
              event={events.get(r.staffId)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

/** One rep's introduction screen during the roll-call. */
function RosterIntroCard({ card, index, total }: { card: RosterCard; index: number; total: number }) {
  const t = TEAM[card.team];
  const tier3 = tierProgress(card.month).reached >= 3;
  const rich = card.revenue != null && card.revenue >= MONEY_THRESHOLD;
  return (
    <div className="relative flex flex-col items-center gap-4 text-center">
      <p className="gd-rise-1 font-mono text-sm font-bold tracking-[0.5em] uppercase sm:text-lg" style={{ color: t.hex }}>
        Now introducing · {t.label} team
      </p>
      <h2 className="gd-name-in font-display leading-none font-black text-white uppercase [font-size:clamp(3rem,13vw,9rem)]">
        {card.name}
      </h2>

      {tier3 && (
        <div className="gd-rise-2 flex flex-col items-center gap-1">
          <span className="rounded-full border border-[var(--gold)] bg-[rgba(255,201,40,0.12)] px-5 py-1.5 text-lg font-black tracking-[0.18em] text-[var(--gold)] uppercase shadow-[0_0_28px_-4px_rgba(255,201,40,0.75)]">
            ✦ Tier 3 Club ✦
          </span>
          <span className="text-base font-semibold text-[rgba(255,201,40,0.85)] sm:text-lg">
            Elite — <span className="font-black text-[var(--gold)]">{card.month}</span> booked this month
          </span>
        </div>
      )}

      <div className="gd-rise-3 flex flex-col items-center gap-2">
        {!tier3 && (
          <p className="text-2xl font-bold text-white/85 sm:text-4xl">
            📋 <span className="font-black text-white">{card.month}</span> bookings this month
          </p>
        )}
        {rich && (
          <p className="text-2xl font-black text-[var(--gold)] sm:text-4xl">
            💰 cha-ching — over <span className="text-white">{overMoney(card.revenue!)}</span> generated
          </p>
        )}
        <p className="mt-1 text-xl font-semibold tracking-wide text-white/55 sm:text-2xl">{taglineFor(card.staffId)}</p>
      </div>

      <p className="gd-rise-3 mt-2 font-mono text-sm font-semibold tracking-[0.3em] text-white/30">
        {index + 1} / {total}
      </p>
    </div>
  );
}

type IntroState = { phase: "title" | "roster" | "go"; idx: number; out: boolean };
type Toast = { key: number; text: string; tone: Side | "gold" | "white"; icon?: string };

export function GameDayWall({ initial }: { initial: BoardsDTO }) {
  const [daily, setDaily] = useState<BoardRowDTO[]>(initial.daily);
  const [monthly, setMonthly] = useState<BoardRowDTO[]>(initial.monthly);
  const [inspectors, setInspectors] = useState<InspectorRowDTO[]>(initial.inspectors);
  const [topJob, setTopJob] = useState(initial.topRevenueJob);
  const [on, setOn] = useState(initial.gameDay);
  const [soundLocked, setSoundLocked] = useState(true);
  const [intro, setIntro] = useState<IntroState | null>(null);
  const [secsLeft, setSecsLeft] = useState<number | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [toastOut, setToastOut] = useState(false);
  const [events, setEvents] = useState<Map<string, RowEvent>>(new Map());
  const [totalPulse, setTotalPulse] = useState<Record<Side, number>>({ orange: 0, blue: 0 });
  const [leadMoment, setLeadMoment] = useState<{ side: Side; key: number } | null>(null);
  const [tieKey, setTieKey] = useState(0);
  const [vsKey, setVsKey] = useState(0);
  const [crownKey, setCrownKey] = useState(0);
  const [overrideLine, setOverrideLine] = useState<string | null>(null);

  const inFlight = useRef(false);
  const prevLeader = useRef<Side | null | undefined>(undefined);
  const prevMargin = useRef<number | undefined>(undefined);
  const prevCounts = useRef<Map<string, number> | null>(null);
  const prevTotals = useRef<Record<Side, number> | null>(null);
  const prevTop = useRef<string | null>(null);
  const eventTimers = useRef<Map<string, number>>(new Map());
  const toastTimer = useRef<number | null>(null);
  const lineTimer = useRef<number | null>(null);
  const wasOn = useRef(initial.gameDay);
  const firstRun = useRef(true);
  const prevSecs = useRef<number | null>(null);
  const introTimers = useRef<number[]>([]);
  const rosterRef = useRef<RosterCard[]>([]);
  const musicRef = useRef<HTMLAudioElement | null>(null);
  const musicFade = useRef<number | null>(null);
  const musicWanted = useRef(false);
  const lastFact = useRef<string | null>(null);
  // Always-current data so the ceremony can snapshot the roster without
  // re-running on every poll.
  const latest = useRef({ daily, monthly });
  latest.current = { daily, monthly };

  /** Show a toast above the matchup banner for `ms`, replacing any current one. */
  const showToast = useCallback((t: Omit<Toast, "key">, ms: number) => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    setToastOut(false);
    setToast({ ...t, key: Date.now() + Math.random() });
    toastTimer.current = window.setTimeout(() => {
      setToastOut(true);
      toastTimer.current = window.setTimeout(() => setToast(null), 400);
    }, ms);
  }, []);

  // ── Countdown to the 7 PM whistle, ticking once a second. ──
  useEffect(() => {
    const tick = () => setSecsLeft(secsUntilGameEnd());
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  // One-time hype the moment we cross into each final-push tier (30/10/5/1 min).
  useEffect(() => {
    if (secsLeft === null) return;
    const prev = prevSecs.current;
    prevSecs.current = secsLeft;
    if (!on || prev === null || secsLeft <= 0) return;
    for (const t of FINAL_PUSH_TIERS) {
      if (prev > t.at && secsLeft <= t.at) {
        playGong();
        showToast({ text: `${t.label} — ${t.sub}`, tone: "gold", icon: "⚡" }, 5000);
        if (!reducedMotion()) {
          confetti({ particleCount: 120, spread: 110, startVelocity: 44, origin: { y: 0.3 }, colors: GOLD_BURST });
        }
      }
    }
  }, [secsLeft, on, showToast]);

  // Every so often, flash up an attention-grabbing fact about the scoreboard.
  useEffect(() => {
    if (!on) return;
    const fire = () => {
      const candidates = buildFacts(latest.current.daily, LABELS, TOP_SCORER_PRIZE);
      if (candidates.length === 0) return;
      const fresh = candidates.filter((f) => f !== lastFact.current);
      const pool = fresh.length ? fresh : candidates;
      const choice = pool[Math.floor(Math.random() * pool.length)] ?? pool[0];
      if (!choice) return;
      lastFact.current = choice;
      showToast({ text: choice, tone: "white", icon: "📣" }, FACT_HOLD_MS);
      playFanfare();
      if (!reducedMotion()) {
        confetti({ particleCount: 50, spread: 70, startVelocity: 36, origin: { y: 0.15 }, colors: GOLD_BURST });
      }
    };
    const id = window.setInterval(fire, FACT_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [on, showToast]);

  // ── Roll-call background music (hype anthem) ──
  const startMusic = useCallback(() => {
    const el = musicRef.current;
    if (!el) return;
    if (musicFade.current) {
      window.clearInterval(musicFade.current);
      musicFade.current = null;
    }
    try {
      el.currentTime = 0;
    } catch {
      /* not seekable yet — fine, it'll start from 0 anyway */
    }
    el.volume = MUSIC_VOL;
    void el.play().catch(() => undefined); // blocked until a gesture — retried on tap
  }, []);

  const fadeMusic = useCallback((ms: number) => {
    const el = musicRef.current;
    if (!el) return;
    if (musicFade.current) window.clearInterval(musicFade.current);
    const steps = 24;
    const v0 = el.volume;
    let k = 0;
    musicFade.current = window.setInterval(
      () => {
        k += 1;
        el.volume = Math.max(0, v0 * (1 - k / steps));
        if (k >= steps) {
          if (musicFade.current) window.clearInterval(musicFade.current);
          musicFade.current = null;
          el.pause();
        }
      },
      Math.max(16, ms / steps),
    );
  }, []);

  const stopMusic = useCallback(() => {
    if (musicFade.current) {
      window.clearInterval(musicFade.current);
      musicFade.current = null;
    }
    musicWanted.current = false;
    if (musicRef.current) musicRef.current.pause();
  }, []);

  // ── Sound: browsers block audio until interaction. On a wall nobody clicks,
  // so keep arming on any interaction and show a prompt until it's running. ──
  useEffect(() => {
    const sync = () => setSoundLocked(!audioRunning());
    const arm = () => {
      armAudio();
      // If the roll-call is up but the browser blocked autoplay, the first tap
      // also kicks off the theme.
      if (musicWanted.current && musicRef.current?.paused) startMusic();
      window.setTimeout(sync, 80);
    };
    sync();
    window.addEventListener("pointerdown", arm);
    window.addEventListener("keydown", arm);
    document.addEventListener("visibilitychange", sync);
    // A wall TV never gets a second click — if the browser auto-suspends an
    // idle context for power saving, nothing above would ever fire again.
    // Keep re-arming (and re-checking the banner) on a timer too.
    const keepAliveId = window.setInterval(arm, 15000);
    return () => {
      window.removeEventListener("pointerdown", arm);
      window.removeEventListener("keydown", arm);
      document.removeEventListener("visibilitychange", sync);
      window.clearInterval(keepAliveId);
    };
  }, [startMusic]);

  const clearIntroTimers = () => {
    introTimers.current.forEach((t) => window.clearTimeout(t));
    introTimers.current = [];
  };

  /** Run the whole opening ceremony: title → roll-call → "let the games begin". */
  const playIntro = useCallback(() => {
    if (reducedMotion()) return; // honour reduced motion — straight to the board
    const roster = buildRoster(latest.current.daily, latest.current.monthly);
    rosterRef.current = roster;
    clearIntroTimers();

    setIntro({ phase: "title", idx: 0, out: false });
    const n = roster.length;

    // The roll-call spans EXACTLY ROSTER_TOTAL_MS end-to-end under the anthem —
    // card i lands at its fraction of that window no matter how many reps.
    if (n > 0) musicWanted.current = true;
    roster.forEach((card, i) => {
      const at = TITLE_MS + Math.round((i * ROSTER_TOTAL_MS) / n);
      introTimers.current.push(
        window.setTimeout(() => {
          setIntro({ phase: "roster", idx: i, out: false });
          if (i === 0) startMusic();
          const tier3 = tierProgress(card.month).reached >= 3;
          const rich = card.revenue != null && card.revenue >= MONEY_THRESHOLD;
          if (tier3) playFanfare();
          else if (rich) playChaChing();
          else playWhoosh();
          if (rich) moneySplash();
        }, at),
      );
    });

    // "LET THE GAMES BEGIN" — duck the music out, ding ding ding + crowd cheer.
    const goAt = TITLE_MS + (n > 0 ? ROSTER_TOTAL_MS : 0);
    introTimers.current.push(
      window.setTimeout(() => {
        setIntro({ phase: "go", idx: 0, out: false });
        musicWanted.current = false;
        fadeMusic(1100);
        playDing();
        introTimers.current.push(
          window.setTimeout(() => playDing(), 230),
          window.setTimeout(() => {
            playDing();
            playApplause(0.8);
          }, 460),
        );
        if (!reducedMotion()) {
          confetti({ particleCount: 220, spread: 130, startVelocity: 50, origin: { y: 0.5 }, colors: GOLD_BURST });
        }
      }, goAt),
    );

    const endAt = goAt + GO_MS;
    introTimers.current.push(
      window.setTimeout(() => setIntro((a) => (a ? { ...a, out: true } : a)), endAt - FADE_MS),
      window.setTimeout(() => setIntro(null), endAt),
    );
  }, [startMusic, fadeMusic]);

  const skipIntro = () => {
    clearIntroTimers();
    stopMusic();
    setIntro((a) => (a ? { ...a, out: true } : a));
    introTimers.current.push(window.setTimeout(() => setIntro(null), FADE_MS));
  };

  useEffect(
    () => () => {
      clearIntroTimers();
      stopMusic();
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
      if (lineTimer.current) window.clearTimeout(lineTimer.current);
      eventTimers.current.forEach((t) => window.clearTimeout(t));
    },
    [stopMusic],
  );

  // Play the ceremony on first load (if already on) and whenever it flips on.
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      if (on) playIntro();
      wasOn.current = on;
      return;
    }
    if (on && !wasOn.current) playIntro();
    wasOn.current = on;
  }, [on, playIntro]);

  const refetch = useCallback(() => {
    if (inFlight.current) return;
    inFlight.current = true;
    fetch("/api/boards", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: BoardsDTO | null) => {
        if (!d || !Array.isArray(d.daily)) return;
        // Keep the last good board on a cold-DB hiccup (empty daily) so the wall
        // never blanks — but always honour the game-day flag so it can flip on.
        if (d.daily.length > 0) {
          setDaily(d.daily);
          if (Array.isArray(d.monthly)) setMonthly(d.monthly);
        }
        if (Array.isArray(d.inspectors)) setInspectors(d.inspectors);
        setTopJob(d.topRevenueJob ?? null);
        setOn(d.gameDay);
      })
      .catch(() => undefined)
      .finally(() => {
        inFlight.current = false;
      });
  }, []);
  useLiveRefresh(["bookings", "clock"], refetch);

  // ── Derived scoreboard state (mirrored by computeGameDayResult) ──
  const s = scoreState(daily);
  const { teamed, orange, blue, orangeTotal, blueTotal, total, margin, leader, maxCount, topIds } = s;
  const topJobId = topJob?.staffId ?? null;
  const line = leadLine(s, LABELS);

  // ── Booking events: per-rep flash/+N, team total pulse, milestones ──
  useEffect(() => {
    const increases = countIncreases(prevCounts.current, teamed);
    prevCounts.current = new Map(teamed.map((r) => [r.staffId, r.count]));
    if (!on || increases.length === 0) return;

    setEvents((prev) => {
      const next = new Map(prev);
      for (const inc of increases) next.set(inc.staffId, { key: Date.now() + Math.random(), delta: inc.to - inc.from });
      return next;
    });
    const sidesHit = new Set<Side>();
    for (const inc of increases) {
      const row = teamed.find((r) => r.staffId === inc.staffId);
      if (row) sidesHit.add(row.team);
      const old = eventTimers.current.get(inc.staffId);
      if (old) window.clearTimeout(old);
      eventTimers.current.set(
        inc.staffId,
        window.setTimeout(() => {
          setEvents((prev) => {
            const next = new Map(prev);
            next.delete(inc.staffId);
            return next;
          });
          eventTimers.current.delete(inc.staffId);
        }, EVENT_MS),
      );
    }
    if (sidesHit.size) {
      setTotalPulse((p) => {
        const n = { ...p };
        for (const side of sidesHit) n[side] = p[side] + 1;
        return n;
      });
    }
  }, [teamed, on]);

  // Team milestones (5, 10, 15, 20…) — a brief toast, no interruption.
  useEffect(() => {
    const prev = prevTotals.current;
    prevTotals.current = { orange: orangeTotal, blue: blueTotal };
    if (!on || !prev) return;
    for (const side of ["orange", "blue"] as const) {
      const hit = milestoneCrossed(prev[side], side === "orange" ? orangeTotal : blueTotal);
      if (hit !== null) showToast({ text: `${LABELS[side].toUpperCase()} HITS ${hit} BOOKINGS`, tone: side, icon: "🔥" }, TOAST_MS);
    }
  }, [orangeTotal, blueTotal, on, showToast]);

  // Lead change — the big moment — and ties.
  useEffect(() => {
    const prev = prevLeader.current;
    prevLeader.current = leader;
    if (!on || prev === undefined) return; // first render seeds silently
    if (leader && prev !== leader) {
      const key = Date.now();
      setLeadMoment({ side: leader, key });
      setVsKey(key);
      if (prev !== null) {
        // A genuine hand-over (not the first lead of the day) gets the full beat.
        setOverrideLine(takesLeadLine(leader, LABELS));
        if (lineTimer.current) window.clearTimeout(lineTimer.current);
        lineTimer.current = window.setTimeout(() => setOverrideLine(null), TOAST_MS);
        showToast({ text: takesLeadLine(leader, LABELS), tone: leader, icon: "🚀" }, TOAST_MS);
        if (!reducedMotion()) {
          confetti({ particleCount: 150, spread: 100, origin: { y: 0.4 }, colors: TEAM[leader].burst });
        }
      }
    } else if (leader === null && prev !== null && total > 0) {
      setTieKey(Date.now());
      setOverrideLine(null);
      showToast({ text: "GAME TIED", tone: "gold", icon: "⚡" }, TOAST_MS);
    }
  }, [leader, total, on, showToast]);

  // Proximity alert: the moment the gap closes to exactly one booking.
  useEffect(() => {
    const prev = prevMargin.current;
    prevMargin.current = margin;
    if (!on || !leader) return;
    if (prev !== undefined && prev !== 1 && margin === 1 && prev > 1) {
      const trailing: Side = leader === "orange" ? "blue" : "orange";
      showToast({ text: `${LABELS[trailing].toUpperCase()} WITHIN ONE!`, tone: trailing, icon: "👀" }, TOAST_MS);
    }
  }, [margin, leader, on, showToast]);

  // New overall #1 — crown moves with a pop, brief gold toast.
  useEffect(() => {
    const single = topIds.size === 1 ? [...topIds][0] ?? null : null;
    const prev = prevTop.current;
    prevTop.current = single;
    if (!on || prev === null || single === null || single === prev) return;
    setCrownKey(Date.now());
    const who = teamed.find((r) => r.staffId === single);
    if (who) showToast({ text: `NEW #1 — ${who.name}`, tone: "gold", icon: "👑" }, TOAST_MS);
  }, [topIds, teamed, on, showToast]);

  const roster = rosterRef.current;
  const introCard = intro?.phase === "roster" ? roster[intro.idx] : undefined;
  const toastColor =
    toast?.tone === "gold"
      ? "var(--gold)"
      : toast?.tone === "white"
        ? "#ffffff"
        : toast
          ? TEAM[toast.tone].hex
          : "#ffffff";

  return (
    <main className="gd-wall relative z-0 flex h-dvh flex-col gap-3 overflow-hidden p-4 text-white 2xl:gap-4 2xl:p-5">
      {/* z-0 is load-bearing: it makes <main> own its stacking context so the
          fixed -z-30 backdrop paints beneath its own background. */}
      <Backdrop leader={on ? leader : null} />

      {/* Bookings gong + celebrate (team members only on the board), and site
          inspections still pop their green celebration + gong. `gameDay` swaps
          the "new booking" beat for a goal celebration only while the battle is on. */}
      <BookingCelebration daily={teamed} inspectors={inspectors} gameDay={on} />

      {/* Roll-call background music (hype anthem). Hidden; driven by the ceremony. */}
      <audio ref={musicRef} src={MUSIC_SRC} preload="auto" className="hidden" aria-hidden />

      {/* ── Opening ceremony ── */}
      {intro && (
        <div
          onPointerDown={() => armAudio()}
          className={cx(
            "fixed inset-0 z-[120] flex flex-col items-center justify-center overflow-hidden bg-[var(--bg)] px-6 text-center",
            intro.out && "gd-intro-out",
          )}
        >
          {introCard && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                background: `radial-gradient(55% 60% at 50% 45%, rgba(${TEAM[introCard.team].rgb}, 0.2), transparent 72%)`,
              }}
            />
          )}

          <button
            type="button"
            onClick={skipIntro}
            className="absolute top-4 right-4 z-10 rounded-full border border-white/20 bg-black/40 px-4 py-1.5 text-sm font-semibold text-white/60 backdrop-blur transition-colors hover:text-white"
          >
            Skip ▶
          </button>

          <div className="relative">
            {intro.phase === "title" && (
              <div className="flex flex-col items-center">
                <div aria-hidden className="pointer-events-none absolute inset-0 bg-white gd-flash" />
                <p className="gd-fade-up font-mono text-sm font-bold tracking-[0.5em] text-[var(--gold)] uppercase sm:text-lg">
                  Today only
                </p>
                <h1 className="gd-slam font-display mt-3 font-black tracking-tight text-white uppercase italic [font-size:clamp(3.5rem,15vw,11rem)]">
                  Game Day
                </h1>
                <div className="mt-6 flex items-center gap-5 sm:gap-8">
                  <span
                    className="gd-charge-left font-display text-4xl font-black uppercase sm:text-6xl"
                    style={{ color: TEAM.orange.hex }}
                  >
                    {TEAM.orange.label} team
                  </span>
                  <span className="font-display text-2xl font-black text-white/50 italic sm:text-4xl">VS</span>
                  <span
                    className="gd-charge-right font-display text-4xl font-black uppercase sm:text-6xl"
                    style={{ color: TEAM.blue.hex }}
                  >
                    {TEAM.blue.label} team
                  </span>
                </div>
                <p className="gd-fade-up mt-8 max-w-3xl text-base font-semibold text-white/70 sm:text-xl">
                  ⭐ Top scorer <span className="font-black text-[var(--gold)]">${TOP_SCORER_PRIZE}</span> · 💼 Top revenue job{" "}
                  <span className="font-black text-[var(--gold)]">${JOB_REVENUE_PRIZE}</span>
                  {topJob && (
                    <>
                      {" "}
                      (<span className="font-black text-white">{topJob.name}</span>)
                    </>
                  )}{" "}
                  · 🏆 Winning team <span className="font-black text-[var(--gold)]">${TEAM_PRIZE} each</span>
                </p>
                <p className="gd-fade-up mt-6 text-sm font-semibold tracking-[0.3em] text-white/40 uppercase">
                  Introducing the players…
                </p>
              </div>
            )}

            {intro.phase === "roster" && introCard && (
              <RosterIntroCard key={introCard.staffId} card={introCard} index={intro.idx} total={roster.length} />
            )}

            {intro.phase === "go" && (
              <div className="flex flex-col items-center">
                <div aria-hidden className="pointer-events-none absolute inset-0 bg-white gd-flash" />
                <p className="gd-fade-up text-5xl sm:text-6xl">🔔 🔔 🔔</p>
                <h1 className="gd-slam font-display mt-4 font-black tracking-tight text-[var(--gold)] uppercase italic [font-size:clamp(2.5rem,11vw,8rem)]">
                  Let the games begin
                </h1>
                <p className="mt-6 text-2xl font-black text-white/80 sm:text-3xl">
                  <span style={{ color: TEAM.orange.hex }}>{TEAM.orange.label}</span> <span className="text-white/40">vs</span>{" "}
                  <span style={{ color: TEAM.blue.hex }}>{TEAM.blue.label}</span> — go go go!
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {soundLocked && (
        <button
          type="button"
          onClick={() => armAudio()}
          className="fixed right-4 bottom-[5rem] z-[60] flex animate-pulse items-center gap-2 rounded-full border border-[var(--gold)]/50 bg-black/85 px-4 py-2 text-sm font-semibold text-[var(--gold)] shadow-lg backdrop-blur"
        >
          <span aria-hidden>🔇</span> Tap anywhere to enable sound
        </button>
      )}

      {!on ? (
        // Standby — keeps polling so it springs to life when a manager starts it.
        <div className="grid flex-1 place-items-center text-center">
          <div>
            <p className="text-6xl">🏁</p>
            <p className="font-display mt-4 text-4xl font-black tracking-tight text-white uppercase italic">Game Day standby</p>
            <p className="mt-2 text-lg text-[var(--muted)]">Waiting for a manager to start the battle…</p>
          </div>
        </div>
      ) : (
        <>
          {/* ── Header: title block + countdown/rewards bar ── */}
          <header className="flex shrink-0 items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <span
                aria-hidden
                className="font-display leading-none font-black text-[var(--green)] italic [font-size:clamp(2.4rem,3.6vw,4rem)]"
                style={{ textShadow: "0 0 24px rgba(183,255,0,0.55)" }}
              >
                ✕
              </span>
              <div className="flex flex-col">
                <h1 className="font-display leading-none font-black tracking-tight text-white uppercase italic [font-size:clamp(2rem,3.2vw,3.6rem)]">
                  Game Day
                </h1>
                <p className="mt-1 text-[0.7rem] font-bold tracking-[0.22em] text-[var(--muted)] uppercase">
                  More <span className="text-[var(--green)]">bookings</span>. More <span className="text-[var(--purple)]">wins</span>.
                </p>
              </div>
            </div>
            <div className="gd-panel flex items-center gap-5 rounded-xl px-4 py-2 [&>*+*]:border-l [&>*+*]:border-[var(--border)] [&>*+*]:pl-5">
              <Countdown secs={secsLeft} />
              <Reward icon="⭐" label="Top scorer" value={`$${TOP_SCORER_PRIZE}`} tone="green" />
              <Reward
                icon="💼"
                label="Top revenue job"
                value={`$${JOB_REVENUE_PRIZE}`}
                tone="purple"
                sub={topJob ? `${topJob.name} 🏅` : undefined}
              />
              <Reward icon="🏆" label="Winning team" value={`$${TEAM_PRIZE} each`} tone="gold" />
            </div>
          </header>

          {/* ── Matchup banner ── */}
          <section
            className={cx("gd-panel gd-banner-sweep relative flex shrink-0 items-stretch overflow-hidden rounded-xl", tieKey > 0 && "gd-gold-pulse")}
            key={`banner-${tieKey}`}
          >
            <MatchupSide side="orange" total={orangeTotal} lead={leader === "orange"} pulseKey={totalPulse.orange} />

            {/* Centre: VS + lead line. */}
            <div className="relative flex w-[clamp(12rem,18vw,20rem)] shrink-0 flex-col items-center justify-center gap-1.5">
              {/* Occasional pulse of light travelling from the leading side in. */}
              {leader && (
                <span
                  aria-hidden
                  className="gd-lead-pulse pointer-events-none absolute inset-y-4 left-0 w-full"
                  style={{
                    ["--dir" as string]: TEAM[leader].dir,
                    background: `linear-gradient(90deg, transparent, rgba(${TEAM[leader].rgb}, 0.35), transparent)`,
                  }}
                />
              )}
              {VS_SPECKS.map((sp, i) => (
                <span
                  key={i}
                  aria-hidden
                  className="gd-speck pointer-events-none absolute rounded-full"
                  style={{
                    left: `${sp.left}%`,
                    top: `${sp.top}%`,
                    width: sp.size,
                    height: sp.size,
                    background: TEAM[sp.side].hex,
                    boxShadow: `0 0 ${sp.size * 3}px ${TEAM[sp.side].hex}`,
                    ["--sdx" as string]: `${sp.dx}px`,
                    ["--sd" as string]: `${sp.dur}s`,
                    ["--speck-a" as string]: sp.alpha,
                    animationDelay: `${sp.delay}s`,
                  }}
                />
              ))}
              <span
                key={vsKey}
                className="gd-vs-breathe gd-vs-flash font-display relative leading-none font-black text-white italic [font-size:clamp(2.6rem,4.6vw,5rem)]"
              >
                VS
              </span>
              <p
                key={overrideLine ?? line.text}
                className={cx(
                  "gd-toast-in relative flex items-center gap-2 rounded-full border px-3 py-1 text-[0.7rem] font-black tracking-[0.14em] whitespace-nowrap uppercase",
                  "border-[var(--border)] bg-[var(--panel-2)]",
                )}
                style={{ color: line.side ? TEAM[line.side].hex : line.kind === "tied" ? "var(--gold)" : "#fff" }}
                aria-live="polite"
              >
                {line.side && (
                  <span aria-hidden className="size-2 rounded-full" style={{ background: TEAM[line.side].hex, boxShadow: `0 0 8px ${TEAM[line.side].hex}` }} />
                )}
                {overrideLine ?? line.text}
              </p>
            </div>

            <MatchupSide side="blue" total={blueTotal} lead={leader === "blue"} pulseKey={totalPulse.blue} />

            {/* Lead-change sweep across the new leader's half. */}
            {leadMoment && (
              <span
                key={leadMoment.key}
                aria-hidden
                className={cx(
                  "gd-lead-sweep pointer-events-none absolute inset-y-0 w-1/2",
                  leadMoment.side === "orange" ? "left-0" : "right-0",
                )}
                style={{
                  ["--dir" as string]: TEAM[leadMoment.side].dir,
                  background: `linear-gradient(90deg, transparent, rgba(${TEAM[leadMoment.side].rgb}, 0.5), transparent)`,
                }}
              />
            )}
          </section>

          {/* ── Toast (milestones / lead change / new #1 / facts / final push) ── */}
          {toast && (
            <div
              key={toast.key}
              aria-live="polite"
              className={cx(
                "pointer-events-none fixed inset-x-0 top-[calc(50%-14rem)] z-[58] flex justify-center px-4",
                toastOut ? "gd-toast-out" : "gd-toast-in",
              )}
            >
              <div
                className="gd-panel flex max-w-4xl items-center gap-3 rounded-xl px-5 py-2.5 shadow-2xl shadow-black/60"
                style={{ borderColor: `color-mix(in srgb, ${toastColor} 55%, transparent)`, boxShadow: `0 0 34px -8px ${toastColor}` }}
              >
                {toast.icon && (
                  <span aria-hidden className="text-2xl">
                    {toast.icon}
                  </span>
                )}
                <span className="font-display text-lg font-black tracking-wide uppercase sm:text-2xl" style={{ color: toastColor }}>
                  {toast.text}
                </span>
              </div>
            </div>
          )}

          {/* ── Leaderboards ── */}
          <div className="relative z-0 grid min-h-0 flex-1 grid-cols-2 gap-4">
            <TeamPanel
              side="orange"
              reps={orange}
              total={orangeTotal}
              lead={leader === "orange"}
              boardMax={maxCount}
              topIds={topIds}
              topJobId={topJobId}
              crownKey={crownKey}
              events={events}
              totalPulse={totalPulse.orange}
            />
            <TeamPanel
              side="blue"
              reps={blue}
              total={blueTotal}
              lead={leader === "blue"}
              boardMax={maxCount}
              topIds={topIds}
              topJobId={topJobId}
              crownKey={crownKey}
              events={events}
              totalPulse={totalPulse.blue}
            />
          </div>

          {/* ── Footer rewards ── */}
          <footer className="gd-panel grid shrink-0 grid-cols-4 items-center rounded-xl px-5 py-2.5 [&>*+*]:border-l [&>*+*]:border-[var(--border)] [&>*+*]:pl-5">
            <Reward icon="🎯" label="Each booking" value="= 1 point" tone="green" />
            <Reward icon="⭐" label="Top scorer" value={`$${TOP_SCORER_PRIZE}`} tone="green" />
            <Reward icon="💼" label="Top revenue job" value={`$${JOB_REVENUE_PRIZE}`} tone="purple" />
            <Reward icon="🏆" label="Winning team" value={`$${TEAM_PRIZE} each`} tone="gold" />
          </footer>
        </>
      )}
    </main>
  );
}
