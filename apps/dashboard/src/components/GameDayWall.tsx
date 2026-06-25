"use client";

import confetti from "canvas-confetti";
import { useCallback, useEffect, useRef, useState } from "react";

import { cx } from "@nlr/ui";

import type { BoardRowDTO, BoardsDTO } from "./Board";
import { BookingCelebration } from "./BookingCelebration";
import { armAudio, audioRunning, playApplause, playDing } from "../lib/celebrate";
import { useLiveRefresh } from "../lib/live";

/**
 * Full-screen DARK "Game Day" wall board for /live/game-day — a 7-v-8 Orange vs
 * Blue battle. Opens with a hype CEREMONY: a slam-in title, then every rostered
 * rep is introduced one-by-one (name, team, bookings this month + revenue +
 * a tagline, each with a "ding"), then "LET THE GAMES BEGIN" with a triple ding
 * and crowd cheer — and only then the live scoreboard. The board's flames + aura
 * grow the further ahead the leading team is, and the day's top scorer is crowned
 * for the $100. Every booking still fires the shared gong + celebration. Polls
 * /api/boards and replays the ceremony whenever a manager flips Game Day on.
 */

// Prize money — edit these two numbers to change what's on the line.
const TOP_SCORER_PRIZE = 100; // day's single highest individual scorer
const TEAM_PRIZE = 50; // every member of the winning team

// Ceremony timing (ms).
const TITLE_MS = 3500; // opening "GAME DAY" slam
const CARD_MS = 2700; // each rep's introduction
const GO_MS = 3000; // "LET THE GAMES BEGIN"
const FADE_MS = 550; // veil fade-out tail

type Side = "orange" | "blue";

const TEAM: Record<
  Side,
  {
    label: string;
    emoji: string;
    rgb: string; // "r, g, b" for building rgba() glows/auras
    box: string;
    name: string;
    num: string;
    heading: string;
    barFrom: string;
    barTo: string;
  }
> = {
  orange: {
    label: "Orange",
    emoji: "🟠",
    rgb: "249, 115, 22",
    box: "border-orange-500/70 bg-orange-500/10",
    name: "text-orange-200",
    num: "text-orange-300",
    heading: "text-orange-400",
    barFrom: "from-orange-400",
    barTo: "to-orange-600",
  },
  blue: {
    label: "Blue",
    emoji: "🔵",
    rgb: "34, 211, 238",
    box: "border-cyan-400/70 bg-cyan-400/10",
    name: "text-cyan-100",
    num: "text-cyan-200",
    heading: "text-cyan-300",
    barFrom: "from-cyan-300",
    barTo: "to-cyan-500",
  },
};

const TAGLINES = [
  "Closer. 🔒",
  "Always be booking. 📞",
  "Ice in the veins. 🧊",
  "Brings the heat. 🔥",
  "Phone never stops ringing. ☎️",
  "Built different. 💪",
  "Here to win. 🏆",
  "Lethal on the leads. 🎯",
  "Pure hustle. ⚡",
  "Books in their sleep. 😴",
];

/** Stable per-rep tagline (deterministic hash of their id — same every show). */
function taglineFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return TAGLINES[h % TAGLINES.length] ?? "Here to win. 🏆";
}

/** "over $140,000" — rounds revenue DOWN to a clean figure so it's never a lie. */
function overMoney(n: number): string {
  let v: number;
  if (n >= 100000) v = Math.floor(n / 10000) * 10000;
  else if (n >= 10000) v = Math.floor(n / 1000) * 1000;
  else v = Math.floor(n / 100) * 100;
  return `$${v.toLocaleString()}`;
}

/** How "hot" the lead is (0 = tied, 4 = blowout) — drives flames + aura size. */
function heatOf(margin: number): 0 | 1 | 2 | 3 | 4 {
  if (margin <= 0) return 0;
  if (margin <= 2) return 1;
  if (margin <= 4) return 2;
  if (margin <= 7) return 3;
  return 4;
}

function reducedMotion(): boolean {
  return (
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

interface RosterCard {
  staffId: string;
  name: string;
  team: Side;
  month: number;
  revenue: number | null;
}

/** Build the roll-call: every rep on a team, with this month's count + revenue
 * (from the monthly board), underdogs first so it crescendos to the top earner. */
function buildRoster(daily: BoardRowDTO[], monthly: BoardRowDTO[]): RosterCard[] {
  const byId = new Map<string, RosterCard>();
  for (const r of monthly) {
    if (r.team === "orange" || r.team === "blue") {
      byId.set(r.staffId, {
        staffId: r.staffId,
        name: r.name,
        team: r.team,
        month: r.count,
        revenue: typeof r.revenue === "number" ? r.revenue : null,
      });
    }
  }
  for (const r of daily) {
    if ((r.team === "orange" || r.team === "blue") && !byId.has(r.staffId)) {
      byId.set(r.staffId, { staffId: r.staffId, name: r.name, team: r.team, month: 0, revenue: null });
    }
  }
  return [...byId.values()].sort((a, b) => a.month - b.month || a.name.localeCompare(b.name));
}

/** One rep's introduction screen during the roll-call. */
function RosterIntroCard({ card, index, total }: { card: RosterCard; index: number; total: number }) {
  const t = TEAM[card.team];
  return (
    <div className="relative flex flex-col items-center gap-5 text-center">
      <p
        className="gd-fade-up font-mono text-sm font-bold tracking-[0.5em] uppercase sm:text-lg"
        style={{ color: `rgb(${t.rgb})` }}
      >
        Now introducing · {t.emoji} Team {t.label}
      </p>
      <h2 className="gd-slam font-display leading-none font-black text-white uppercase [font-size:clamp(3rem,13vw,9rem)]">
        {card.name}
      </h2>
      <div className="gd-fade-up flex flex-col items-center gap-2">
        <p className="text-2xl font-bold text-white/85 sm:text-4xl">
          📋 <span className="font-black text-white">{card.month}</span> bookings this month
        </p>
        {card.revenue != null && card.revenue >= 1000 && (
          <p className="text-2xl font-black text-accent-300 sm:text-4xl">
            💰 cha-ching — over <span className="text-accent-200">{overMoney(card.revenue)}</span>{" "}
            generated
          </p>
        )}
        <p className="mt-1 text-xl font-semibold tracking-wide text-white/55 sm:text-2xl">
          {taglineFor(card.staffId)}
        </p>
      </div>
      <p className="mt-2 font-mono text-sm font-semibold tracking-[0.3em] text-white/30">
        {index + 1} / {total}
      </p>
    </div>
  );
}

/** One player's box on the board — name + today's count. Crowned (gold ring +
 * $100) when they're the day's top scorer. */
function PlayerBox({ r, side, isTop }: { r: BoardRowDTO; side: Side; isTop: boolean }) {
  const t = TEAM[side];
  return (
    <li
      className={cx(
        "relative flex min-h-0 flex-col items-center justify-center overflow-hidden rounded-xl border-2 px-2 py-2 text-center",
        t.box,
        isTop && "border-accent-400 shadow-[0_0_22px_-2px_rgba(255,212,46,0.75)] ring-2 ring-accent-400",
      )}
    >
      {isTop && (
        <span className="absolute -top-3 -right-1 rotate-3 rounded-full bg-accent-400 px-2 py-0.5 text-xs font-black whitespace-nowrap text-brand-950 shadow-md">
          👑 ${TOP_SCORER_PRIZE}
        </span>
      )}
      <p className={cx("w-full truncate text-base font-bold sm:text-lg", t.name)}>{r.name}</p>
      <p
        key={r.count}
        className={cx(
          "gd-bump font-display text-4xl leading-none font-black tabular-nums sm:text-5xl",
          isTop ? "text-accent-300" : t.num,
        )}
      >
        {r.count}
      </p>
    </li>
  );
}

/** A team's column of player boxes, with a heat-scaled aura when it's leading. */
function TeamColumn({
  side,
  reps,
  total,
  isLeader,
  heat,
  topIds,
}: {
  side: Side;
  reps: BoardRowDTO[];
  total: number;
  isLeader: boolean;
  heat: number;
  topIds: Set<string>;
}) {
  const t = TEAM[side];
  const sorted = [...reps].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  return (
    <section className="relative flex min-h-0 flex-col">
      {/* Aura behind the leading team — bigger + brighter the further ahead. */}
      {isLeader && heat > 0 && (
        <div
          aria-hidden
          className={cx("pointer-events-none absolute -inset-3 -z-10 rounded-[2rem]", heat >= 3 && "gd-pulse")}
          style={{
            background: `radial-gradient(60% 70% at 50% 35%, rgba(${t.rgb}, ${0.1 + 0.06 * heat}), transparent 70%)`,
            ["--gd-pulse-lo" as string]: `${0.3 + 0.05 * heat}`,
            ["--gd-pulse-hi" as string]: `${0.5 + 0.08 * heat}`,
          }}
        />
      )}
      <header className="flex shrink-0 items-center justify-between gap-2 px-1">
        <h2 className={cx("font-display text-xl font-black tracking-wide uppercase sm:text-2xl", t.heading)}>
          {t.emoji} {t.label}
        </h2>
        <span className="text-sm font-semibold text-white/45">
          {reps.length} {reps.length === 1 ? "rep" : "reps"} · <span className={t.num}>{total}</span>
        </span>
      </header>
      {sorted.length === 0 ? (
        <div className="mt-2 grid flex-1 place-items-center rounded-2xl border border-dashed border-white/15 p-4 text-center">
          <p className="text-sm font-medium text-white/40">
            No {t.label} reps yet — assign them in Manage.
          </p>
        </div>
      ) : (
        <ul className="mt-2 grid min-h-0 flex-1 grid-cols-2 gap-2.5 p-1 [grid-auto-rows:1fr] sm:gap-3">
          {sorted.map((r) => (
            <PlayerBox key={r.staffId} r={r} side={side} isTop={topIds.has(r.staffId)} />
          ))}
        </ul>
      )}
    </section>
  );
}

/** Centre score plate for one team, with flames over the leader scaled by heat. */
function ScorePlate({
  side,
  total,
  isLeader,
  heat,
}: {
  side: Side;
  total: number;
  isLeader: boolean;
  heat: number;
}) {
  const t = TEAM[side];
  const blur = 16 + heat * 20;
  const spread = isLeader ? -6 + heat * 2 : -10;
  return (
    <div className="relative flex flex-col items-center">
      {isLeader && heat > 0 && (
        <div aria-hidden className="absolute -top-8 flex gap-0.5 text-3xl sm:-top-9 sm:text-4xl">
          {Array.from({ length: heat }).map((_, i) => (
            <span key={i} className="gd-flame" style={{ animationDelay: `${i * 0.1}s` }}>
              🔥
            </span>
          ))}
        </div>
      )}
      <div
        className={cx("grid size-28 place-items-center rounded-3xl border-2 sm:size-36", t.box)}
        style={isLeader && heat > 0 ? { boxShadow: `0 0 ${blur}px ${spread}px rgba(${t.rgb}, 0.8)` } : undefined}
      >
        <span
          key={total}
          className={cx("gd-bump font-display text-6xl font-black tabular-nums sm:text-7xl", t.num)}
        >
          {total}
        </span>
      </div>
      <span className={cx("mt-2 text-sm font-bold tracking-[0.2em] uppercase sm:text-base", t.heading)}>
        {t.emoji} {t.label}
      </span>
    </div>
  );
}

type IntroState = { phase: "title" | "roster" | "go"; idx: number; out: boolean };

export function GameDayWall({ initial }: { initial: BoardsDTO }) {
  const [daily, setDaily] = useState<BoardRowDTO[]>(initial.daily);
  const [monthly, setMonthly] = useState<BoardRowDTO[]>(initial.monthly);
  const [on, setOn] = useState(initial.gameDay);
  const [soundLocked, setSoundLocked] = useState(true);
  const [intro, setIntro] = useState<IntroState | null>(null);
  const inFlight = useRef(false);
  const prevLeader = useRef<Side | null>(null);
  const wasOn = useRef(initial.gameDay);
  const firstRun = useRef(true);
  const introTimers = useRef<number[]>([]);
  const rosterRef = useRef<RosterCard[]>([]);
  // Always-current data so the ceremony can snapshot the roster without
  // re-running on every poll.
  const latest = useRef({ daily, monthly });
  latest.current = { daily, monthly };

  // ── Sound: browsers block audio until interaction. On a wall nobody clicks,
  // so keep arming on any interaction and show a prompt until it's running. ──
  useEffect(() => {
    const sync = () => setSoundLocked(!audioRunning());
    const arm = () => {
      armAudio();
      window.setTimeout(sync, 80);
    };
    sync();
    window.addEventListener("pointerdown", arm);
    window.addEventListener("keydown", arm);
    document.addEventListener("visibilitychange", sync);
    return () => {
      window.removeEventListener("pointerdown", arm);
      window.removeEventListener("keydown", arm);
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);

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
    let t = TITLE_MS;

    // Each rep gets their moment, with a bright "ding".
    roster.forEach((_, i) => {
      introTimers.current.push(
        window.setTimeout(() => {
          setIntro({ phase: "roster", idx: i, out: false });
          playDing();
        }, t),
      );
      t += CARD_MS;
    });

    // "LET THE GAMES BEGIN" — ding ding ding + a crowd cheer + confetti.
    introTimers.current.push(
      window.setTimeout(() => {
        setIntro({ phase: "go", idx: 0, out: false });
        playDing();
        introTimers.current.push(
          window.setTimeout(() => playDing(), 230),
          window.setTimeout(() => {
            playDing();
            playApplause(0.8);
          }, 460),
        );
        if (!reducedMotion()) {
          confetti({ particleCount: 220, spread: 130, startVelocity: 50, origin: { y: 0.5 } });
        }
      }, t),
    );
    t += GO_MS;

    introTimers.current.push(
      window.setTimeout(() => setIntro((a) => (a ? { ...a, out: true } : a)), t - FADE_MS),
      window.setTimeout(() => setIntro(null), t),
    );
  }, []);

  const skipIntro = () => {
    clearIntroTimers();
    setIntro((a) => (a ? { ...a, out: true } : a));
    introTimers.current.push(window.setTimeout(() => setIntro(null), FADE_MS));
  };

  useEffect(() => () => clearIntroTimers(), []);

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
        setOn(d.gameDay);
      })
      .catch(() => undefined)
      .finally(() => {
        inFlight.current = false;
      });
  }, []);
  useLiveRefresh(["bookings", "clock"], refetch);

  // ── Derived scoreboard state ──
  const teamed = daily.filter((r) => r.team === "orange" || r.team === "blue");
  const orange = teamed.filter((r) => r.team === "orange");
  const blue = teamed.filter((r) => r.team === "blue");
  const orangeTotal = orange.reduce((s, r) => s + r.count, 0);
  const blueTotal = blue.reduce((s, r) => s + r.count, 0);
  const total = orangeTotal + blueTotal;
  const margin = Math.abs(orangeTotal - blueTotal);
  const leader: Side | null =
    orangeTotal === blueTotal ? null : orangeTotal > blueTotal ? "orange" : "blue";
  const heat = heatOf(margin);
  const orangeShare = total > 0 ? orangeTotal / total : 0.5;

  // Day's top scorer(s) — the single highest count; ties all share the crown.
  const maxCount = teamed.reduce((m, r) => Math.max(m, r.count), 0);
  const topIds = new Set(teamed.filter((r) => r.count > 0 && r.count === maxCount).map((r) => r.staffId));

  // Confetti when the lead changes hands.
  useEffect(() => {
    if (!on || !leader) {
      prevLeader.current = leader;
      return;
    }
    if (prevLeader.current && prevLeader.current !== leader && !reducedMotion()) {
      confetti({
        particleCount: 150,
        spread: 100,
        origin: { y: 0.4 },
        colors: leader === "orange" ? ["#fb923c", "#fdba74", "#f97316"] : ["#22d3ee", "#67e8f9", "#06b6d4"],
      });
    }
    prevLeader.current = leader;
  }, [leader, on]);

  const leadLine =
    leader === null
      ? total === 0
        ? "Tip-off! First booking lights up the board 🚚"
        : "Dead heat — anyone's game 🤝"
      : `${TEAM[leader].emoji} ${TEAM[leader].label} ${heat >= 4 ? "is running away with it" : heat >= 3 ? "pulling clear" : "leads"} by ${margin} 🚚💨`;

  const roster = rosterRef.current;
  const introCard = intro?.phase === "roster" ? roster[intro.idx] : undefined;

  return (
    <main className="relative flex h-dvh flex-col gap-3 overflow-hidden bg-black p-4 text-white sm:p-5">
      {/* Bookings still gong + celebrate — only team members appear on this wall. */}
      <BookingCelebration daily={teamed} />

      {/* ── Opening ceremony ── */}
      {intro && (
        <div
          onPointerDown={() => armAudio()}
          className={cx(
            "fixed inset-0 z-[120] flex flex-col items-center justify-center overflow-hidden bg-ink-950 px-6 text-center",
            intro.out && "gd-intro-out",
          )}
        >
          {/* Team-tinted backdrop during the roll-call. */}
          {introCard && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 -z-0"
              style={{
                background: `radial-gradient(55% 60% at 50% 45%, rgba(${TEAM[introCard.team].rgb}, 0.22), transparent 72%)`,
              }}
            />
          )}

          {/* Skip control (small, out of the way). */}
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
                <p className="font-mono text-sm font-bold tracking-[0.5em] text-accent-400 uppercase gd-fade-up sm:text-lg">
                  Today only
                </p>
                <h1 className="font-display mt-3 font-black tracking-tight text-white uppercase gd-slam [font-size:clamp(3.5rem,15vw,11rem)]">
                  Game Day
                </h1>
                <div className="mt-6 flex items-center gap-5 sm:gap-8">
                  <span className="gd-charge-left font-display text-4xl font-black text-orange-400 uppercase sm:text-6xl">
                    🟠 Orange
                  </span>
                  <span className="font-display text-2xl font-black text-white/50 sm:text-4xl">VS</span>
                  <span className="gd-charge-right font-display text-4xl font-black text-cyan-300 uppercase sm:text-6xl">
                    Blue 🔵
                  </span>
                </div>
                <p className="mt-8 max-w-2xl text-base font-semibold text-white/70 gd-fade-up sm:text-xl">
                  👑 Top scorer wins{" "}
                  <span className="font-black text-accent-300">${TOP_SCORER_PRIZE}</span> · 🏆 Winning
                  team <span className="font-black text-accent-300">${TEAM_PRIZE} each</span>
                </p>
                <p className="mt-6 text-sm font-semibold tracking-[0.3em] text-white/40 uppercase gd-fade-up">
                  Introducing the players…
                </p>
              </div>
            )}

            {intro.phase === "roster" && introCard && (
              <RosterIntroCard
                key={introCard.staffId}
                card={introCard}
                index={intro.idx}
                total={roster.length}
              />
            )}

            {intro.phase === "go" && (
              <div className="flex flex-col items-center">
                <div aria-hidden className="pointer-events-none absolute inset-0 bg-white gd-flash" />
                <p className="text-5xl gd-fade-up sm:text-6xl">🔔 🔔 🔔</p>
                <h1 className="font-display mt-4 font-black tracking-tight text-accent-300 uppercase gd-slam [font-size:clamp(2.5rem,11vw,8rem)]">
                  Let the games begin
                </h1>
                <p className="mt-6 text-2xl font-black text-white/80 sm:text-3xl">
                  🟠 Orange <span className="text-white/40">vs</span> Blue 🔵 — go go go!
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
          className="fixed right-4 bottom-4 z-[60] flex animate-pulse items-center gap-2 rounded-full border border-accent-400/50 bg-black/85 px-4 py-2 text-sm font-semibold text-accent-200 shadow-lg backdrop-blur"
        >
          <span aria-hidden>🔇</span> Tap anywhere to enable sound
        </button>
      )}

      {!on ? (
        // Standby — keeps polling so it springs to life when a manager starts it.
        <div className="grid flex-1 place-items-center text-center">
          <div>
            <p className="text-6xl">🏁</p>
            <p className="font-display mt-4 text-4xl font-black tracking-tight text-white uppercase">
              Game Day standby
            </p>
            <p className="mt-2 text-lg text-white/50">Waiting for a manager to start the battle…</p>
          </div>
        </div>
      ) : (
        <>
          {/* ── Header band: title + live prize ribbon ── */}
          <header className="flex shrink-0 flex-wrap items-center justify-between gap-3">
            <div className="flex items-baseline gap-3">
              <span className="text-3xl">🏆</span>
              <h1 className="font-display text-3xl font-black tracking-tight text-white uppercase sm:text-4xl">
                Game Day
              </h1>
              <span className="font-display text-2xl font-black tracking-wide text-white/30 uppercase sm:text-3xl">
                Orange vs Blue
              </span>
            </div>
            <div className="relative overflow-hidden rounded-full border border-accent-400/40 bg-white/[0.04] px-4 py-1.5">
              <span aria-hidden className="pointer-events-none absolute inset-0 gd-shimmer" />
              <p className="relative flex items-center gap-3 text-sm font-bold whitespace-nowrap sm:text-base">
                <span className="text-accent-200">👑 Top scorer ${TOP_SCORER_PRIZE}</span>
                <span aria-hidden className="text-white/20">|</span>
                <span className="text-accent-200">🏆 Winning team ${TEAM_PRIZE} each</span>
              </p>
            </div>
          </header>

          {/* ── Scoreboard: Orange total · tug-of-war · Blue total ── */}
          <section className="flex shrink-0 items-center gap-4 rounded-3xl border border-white/10 bg-white/[0.03] px-5 py-4 sm:gap-8 sm:px-8">
            <ScorePlate side="orange" total={orangeTotal} isLeader={leader === "orange"} heat={heat} />

            <div className="flex min-w-0 flex-1 flex-col items-center gap-3">
              <span className="font-display text-3xl font-black tracking-[0.2em] text-white/40 uppercase sm:text-4xl">
                VS
              </span>
              {/* Tug-of-war: the boundary slides toward whoever's ahead. */}
              <div className="flex h-5 w-full overflow-hidden rounded-full border border-white/15 sm:h-6">
                <div
                  className={cx("h-full bg-gradient-to-r transition-all duration-700", TEAM.orange.barFrom, TEAM.orange.barTo)}
                  style={{ width: `${Math.round(orangeShare * 100)}%` }}
                />
                <div
                  className={cx("h-full flex-1 bg-gradient-to-r transition-all duration-700", TEAM.blue.barFrom, TEAM.blue.barTo)}
                />
              </div>
              <p className="text-center text-lg font-black text-white sm:text-2xl">{leadLine}</p>
            </div>

            <ScorePlate side="blue" total={blueTotal} isLeader={leader === "blue"} heat={heat} />
          </section>

          {/* ── Team rosters fill the rest of the wall ── */}
          <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-2">
            <TeamColumn
              side="orange"
              reps={orange}
              total={orangeTotal}
              isLeader={leader === "orange"}
              heat={heat}
              topIds={topIds}
            />
            <TeamColumn
              side="blue"
              reps={blue}
              total={blueTotal}
              isLeader={leader === "blue"}
              heat={heat}
              topIds={topIds}
            />
          </div>
        </>
      )}
    </main>
  );
}
