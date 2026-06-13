"use client";

import confetti from "canvas-confetti";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import { cx } from "@nlr/ui";

import type { BoardRowDTO } from "./Board";
import { setGameDay } from "../app/actions/manage";
import { useLiveRefresh } from "../lib/live";

const TEAM = {
  orange: {
    label: "Orange",
    emoji: "🟠",
    panel: "border-orange-300 bg-orange-50",
    lead: "ring-4 ring-orange-300",
    big: "text-orange-600",
    chip: "text-orange-700",
    row: "border-orange-200",
  },
  blue: {
    label: "Blue",
    emoji: "🔵",
    panel: "border-sky-300 bg-sky-50",
    lead: "ring-4 ring-sky-300",
    big: "text-sky-600",
    chip: "text-sky-700",
    row: "border-sky-200",
  },
} as const;

function TeamPanel({
  side,
  total,
  reps,
  leading,
}: {
  side: "orange" | "blue";
  total: number;
  reps: BoardRowDTO[];
  leading: boolean;
}) {
  const t = TEAM[side];
  return (
    <section
      className={cx(
        "rounded-3xl border-2 p-5 shadow-sm transition-all sm:p-6",
        t.panel,
        leading && t.lead,
      )}
    >
      <div className="flex items-center justify-between">
        <p className={cx("text-sm font-bold tracking-widest uppercase", t.chip)}>
          {t.emoji} {t.label}
        </p>
        {leading && (
          <span className={cx("rounded-full bg-white px-2.5 py-1 text-xs font-bold uppercase", t.chip)}>
            Leading
          </span>
        )}
      </div>
      <p className={cx("mt-1 text-7xl font-bold tracking-tight tabular-nums", t.big)}>{total}</p>
      <ul className="mt-4 space-y-1">
        {reps
          .slice()
          .sort((a, b) => b.count - a.count)
          .map((r) => (
            <li
              key={r.staffId}
              className={cx("flex items-center justify-between border-b py-1.5 last:border-0", t.row)}
            >
              <span className="truncate font-semibold text-brand-900">{r.name}</span>
              <span className="text-lg font-bold tabular-nums text-brand-900">{r.count}</span>
            </li>
          ))}
      </ul>
    </section>
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

  // Celebrate when the lead changes hands.
  useEffect(() => {
    if (!on || !leader) {
      prevLeader.current = leader;
      return;
    }
    if (prevLeader.current && prevLeader.current !== leader) {
      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        confetti({
          particleCount: 120,
          spread: 90,
          origin: { y: 0.4 },
          colors: leader === "orange" ? ["#fb923c", "#fdba74"] : ["#38bdf8", "#7dd3fc"],
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
    <div className="max-w-5xl">
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
              ? "Hit Start Game Day to light up the board in team colours and kick off Orange vs Blue."
              : "A manager hasn't started Game Day yet. Check back when the battle's on."}
          </p>
        </div>
      ) : (
        <>
          {/* Comparative scoreboard */}
          <div className="mt-6 grid items-stretch gap-4 sm:grid-cols-[1fr_auto_1fr] sm:gap-2">
            <TeamPanel side="orange" total={orangeTotal} reps={orange} leading={leader === "orange"} />
            <div className="flex flex-row items-center justify-center gap-3 sm:flex-col">
              <span className="font-display text-3xl font-bold text-slate-500">VS</span>
            </div>
            <TeamPanel side="blue" total={blueTotal} reps={blue} leading={leader === "blue"} />
          </div>

          <p className="mt-4 text-center text-base font-semibold text-brand-900">
            {leader === null
              ? "Dead heat — it's all to play for 🤝"
              : `${leader === "orange" ? "🟠 Orange" : "🔵 Blue"} leads by ${Math.abs(orangeTotal - blueTotal)} 🚚💨`}
          </p>
        </>
      )}
    </div>
  );
}
