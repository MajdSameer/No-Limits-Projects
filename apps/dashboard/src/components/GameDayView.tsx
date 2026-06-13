"use client";

import confetti from "canvas-confetti";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import { cx } from "@nlr/ui";

import type { BoardRowDTO } from "./Board";
import { setGameDay } from "../app/actions/manage";
import { useLiveRefresh } from "../lib/live";

const TEAM = {
  orange: {
    label: "Orange team",
    emoji: "🟠",
    heading: "text-orange-400",
    box: "border-orange-500/70 bg-orange-500/10",
    name: "text-orange-300",
    num: "text-orange-400",
    total: "text-orange-400",
    glow: "shadow-[0_0_40px_-8px_rgba(249,115,22,0.8)]",
  },
  blue: {
    label: "Blue team",
    emoji: "🔵",
    heading: "text-cyan-300",
    box: "border-cyan-400/70 bg-cyan-400/10",
    name: "text-cyan-200",
    num: "text-cyan-300",
    total: "text-cyan-300",
    glow: "shadow-[0_0_40px_-8px_rgba(34,211,238,0.8)]",
  },
} as const;

const MEDAL: Record<1 | 2 | 3, { icon: string; label: string }> = {
  1: { icon: "👑", label: "Top scorer today" },
  2: { icon: "🥈", label: "2nd today" },
  3: { icon: "🥉", label: "3rd today" },
};

function PlayerBox({
  side,
  name,
  count,
  rank,
}: {
  side: "orange" | "blue";
  name: string;
  count: number;
  rank?: 1 | 2 | 3;
}) {
  const t = TEAM[side];
  return (
    <div
      className={cx(
        "relative rounded-xl border-2 px-2 py-2 text-center",
        t.box,
        rank === 1 && "ring-2 ring-accent-400",
      )}
    >
      {rank && (
        <span className="absolute -top-3.5 -right-2 text-2xl drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)]">
          <span aria-hidden>{MEDAL[rank].icon}</span>
          <span className="sr-only">{MEDAL[rank].label}</span>
        </span>
      )}
      <p className={cx("truncate text-sm font-bold", t.name)}>{name}</p>
      <p className={cx("font-display text-4xl font-bold tabular-nums", t.num)}>{count}</p>
    </div>
  );
}

function TeamGrid({
  side,
  reps,
  rankOf,
}: {
  side: "orange" | "blue";
  reps: BoardRowDTO[];
  rankOf: (staffId: string) => 1 | 2 | 3 | undefined;
}) {
  const t = TEAM[side];
  return (
    <div>
      <h2 className={cx("text-center text-lg font-bold tracking-wide uppercase", t.heading)}>
        {t.emoji} {t.label}
      </h2>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[...reps]
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((r) => (
            <PlayerBox key={r.staffId} side={side} name={r.name} count={r.count} rank={rankOf(r.staffId)} />
          ))}
      </div>
    </div>
  );
}

export function GameDayView({
  initial,
  isManager,
}: {
  initial: { daily: BoardRowDTO[]; gameDay: boolean };
  isManager: boolean;
}) {
  const [daily, setDaily] = useState(initial.daily);
  const [on, setOn] = useState(initial.gameDay);
  const [pending, startTransition] = useTransition();
  const prevLeader = useRef<string | null>(null);

  const refetch = useCallback(() => {
    fetch("/api/boards", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { daily: BoardRowDTO[]; gameDay: boolean } | null) => {
        if (d) {
          setDaily(d.daily);
          setOn(d.gameDay);
        }
      })
      .catch(() => undefined);
  }, []);
  useLiveRefresh(["bookings", "clock"], refetch);

  const orange = daily.filter((r) => r.team === "orange");
  const blue = daily.filter((r) => r.team === "blue");
  const orangeTotal = orange.reduce((s, r) => s + r.count, 0);
  const blueTotal = blue.reduce((s, r) => s + r.count, 0);
  const leader = orangeTotal === blueTotal ? null : orangeTotal > blueTotal ? "orange" : "blue";

  // Day's top 3 across both teams (only count > 0 earns a medal).
  const podium = [...orange, ...blue]
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 3);
  const rankOf = (staffId: string): 1 | 2 | 3 | undefined => {
    const i = podium.findIndex((r) => r.staffId === staffId);
    return i === 0 ? 1 : i === 1 ? 2 : i === 2 ? 3 : undefined;
  };

  useEffect(() => {
    if (!on || !leader) {
      prevLeader.current = leader;
      return;
    }
    if (prevLeader.current && prevLeader.current !== leader) {
      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        confetti({
          particleCount: 140,
          spread: 90,
          origin: { y: 0.4 },
          colors: leader === "orange" ? ["#fb923c", "#fdba74"] : ["#22d3ee", "#67e8f9"],
        });
      }
    }
    prevLeader.current = leader;
  }, [leader, on]);

  const toggle = () =>
    startTransition(async () => {
      await setGameDay(!on);
      setOn(!on);
      refetch();
    });

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">🏆 Game Day</p>
          <h1 className="mt-1 text-4xl font-bold tracking-tight text-brand-900">Orange vs Blue</h1>
        </div>
        {isManager && (
          <button
            type="button"
            onClick={toggle}
            disabled={pending}
            className={cx(
              "min-h-10 rounded-full px-5 text-sm font-semibold shadow-sm transition-all",
              on
                ? "bg-gradient-to-r from-orange-700 to-sky-700 text-white"
                : "border border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:text-brand-900",
            )}
          >
            {on ? "End Game Day" : "Start Game Day"}
          </button>
        )}
      </div>

      {!on ? (
        <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="text-5xl">🏁</p>
          <p className="mt-3 text-lg font-bold text-brand-900">Game Day is off</p>
          <p className="mt-1 text-sm text-slate-500">
            {isManager
              ? "Hit Start Game Day to light up the scoreboard and kick off Orange vs Blue."
              : "A manager hasn't started Game Day yet. Check back when the battle's on."}
          </p>
        </div>
      ) : (
        // The stadium scoreboard — dark, neon, and symmetric.
        <section className="ink-grain mt-6 overflow-hidden rounded-3xl bg-ink-950 p-6 shadow-2xl shadow-brand-950/40 sm:p-10">
          <p className="font-display text-center text-4xl font-bold tracking-wide text-accent-400 uppercase sm:text-5xl">
            Game Day
          </p>

          <div className="mt-8 grid items-center gap-8 lg:grid-cols-[1fr_auto_1fr] lg:gap-6">
            {/* Left team */}
            <TeamGrid side="orange" reps={orange} rankOf={rankOf} />

            {/* Centre scoreboard — totals stacked with VS between */}
            <div className="flex flex-row items-center justify-center gap-6 lg:flex-col lg:gap-3">
              <div
                className={cx(
                  "grid size-28 place-items-center rounded-2xl border-2 border-orange-500/70 bg-orange-500/10 sm:size-32",
                  leader === "orange" && TEAM.orange.glow,
                )}
              >
                <span className="font-display text-6xl font-bold tabular-nums text-orange-400 sm:text-7xl">
                  {orangeTotal}
                </span>
              </div>
              <span className="font-display text-3xl font-bold text-slate-400">VS</span>
              <div
                className={cx(
                  "grid size-28 place-items-center rounded-2xl border-2 border-cyan-400/70 bg-cyan-400/10 sm:size-32",
                  leader === "blue" && TEAM.blue.glow,
                )}
              >
                <span className="font-display text-6xl font-bold tabular-nums text-cyan-300 sm:text-7xl">
                  {blueTotal}
                </span>
              </div>
            </div>

            {/* Right team */}
            <TeamGrid side="blue" reps={blue} rankOf={rankOf} />
          </div>

          <p className="mt-8 text-center text-lg font-bold text-white">
            {leader === null
              ? "Dead heat — it's all to play for 🤝"
              : `${leader === "orange" ? "🟠 Orange" : "🔵 Blue"} leads by ${Math.abs(orangeTotal - blueTotal)} 🚚💨`}
          </p>
        </section>
      )}
    </div>
  );
}
