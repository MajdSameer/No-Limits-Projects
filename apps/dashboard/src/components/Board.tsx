"use client";

import confetti from "canvas-confetti";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { cx } from "@nlr/ui";

import { armAudio } from "../lib/celebrate";
import { BookingCelebration } from "./BookingCelebration";
import { DailyCell } from "./DailyCell";
import { useLiveRefresh } from "../lib/live";
import { sydneyToday } from "../lib/sydney";
import { tierProgress } from "../lib/tiers";

export interface BoardRowDTO {
  staffId: string;
  name: string;
  count: number;
  goal: number | null;
  gender: "f" | "m" | "x";
  team: "orange" | "blue" | null;
  /** MovePro codes behind today's count (daily board, live-sheet mode). */
  jobCodes?: string[];
}

interface AllocSlotDTO {
  staffId: string;
  name: string;
  sharePct: number;
  leadsToday: number;
}

export interface BoardsDTO {
  daily: BoardRowDTO[];
  yesterday: BoardRowDTO[];
  monthly: BoardRowDTO[];
  pipeline: BoardRowDTO[];
  allocation: { eligible: AllocSlotDTO[]; nextUp: string | null; totalLeadsToday: number };
  gameDay: boolean;
  monthlyGoal: number;
  monthlyTotal: number;
  /** Combined daily target = sum of goals of reps clocked in today. */
  dailyTarget: number;
  /** How many reps are clocked in today. */
  activeToday: number;
  generatedAtISO: string;
}

function genderDot(g: "f" | "m" | "x"): string {
  return g === "f" ? "bg-pink-400" : g === "m" ? "bg-sky-400" : "bg-slate-300";
}

function monthlyMessage(pct: number): string {
  if (pct >= 100) return "GOAL SMASHED — what a month 🎉🎉";
  if (pct >= 90) return "Final stretch — bring it home 🏁";
  if (pct >= 75) return "So close to target — keep firing 🔥";
  if (pct >= 50) return "Over halfway there — push on 💪";
  if (pct >= 25) return "Building nicely — keep the leads coming 🚚";
  return "Fresh month, big target — let's chase it 🚀";
}

function fireGoalConfetti(rows: BoardRowDTO[]) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const key = `nl-goalhits-${sydneyToday()}`;
  const seen = new Set<string>(JSON.parse(localStorage.getItem(key) ?? "[]") as string[]);
  let fired = false;
  for (const r of rows) {
    if (r.goal && r.count >= r.goal && !seen.has(r.staffId)) {
      seen.add(r.staffId);
      fired = true;
    }
  }
  if (fired) {
    localStorage.setItem(key, JSON.stringify([...seen]));
    confetti({
      particleCount: 150,
      spread: 95,
      origin: { y: 0.35 },
      colors: ["#ffd42e", "#fff389", "#f472b6", "#38bdf8"],
    });
  }
}

export function Board({
  initial,
  welcome,
  isManager,
}: {
  initial: BoardsDTO;
  welcome?: string | null;
  isManager?: boolean;
}) {
  const [data, setData] = useState<BoardsDTO>(initial);
  const [greet, setGreet] = useState<string | null>(welcome ?? null);
  const greetFired = useRef(false);
  const inFlight = useRef(false);

  // Enable the gong after the first interaction (browser autoplay policy).
  useEffect(() => {
    const arm = () => armAudio();
    window.addEventListener("pointerdown", arm, { once: true });
    window.addEventListener("keydown", arm, { once: true });
    return () => {
      window.removeEventListener("pointerdown", arm);
      window.removeEventListener("keydown", arm);
    };
  }, []);

  const refetch = useCallback(() => {
    if (inFlight.current) return; // don't stack — the board query takes a few seconds
    inFlight.current = true;
    fetch("/api/boards", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      // Ignore the empty fallback the API returns on a cold-DB hiccup.
      .then((d: BoardsDTO | null) => {
        if (d && Array.isArray(d.daily) && d.daily.length > 0) setData(d);
      })
      .catch(() => undefined)
      .finally(() => {
        inFlight.current = false;
      });
  }, []);
  useLiveRefresh(["bookings", "clock"], refetch);

  useEffect(() => fireGoalConfetti(data.daily), [data]);

  useEffect(() => {
    if (!greet || greetFired.current) return;
    greetFired.current = true;
    if (window.location.search.includes("welcome")) window.history.replaceState({}, "", "/");
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      confetti({ particleCount: 70, spread: 60, origin: { y: 0.2 }, colors: ["#ffd42e", "#fff389"] });
    }
    const t = setTimeout(() => setGreet(null), 6000);
    return () => clearTimeout(t);
  }, [greet]);

  const monthly = [...data.monthly].sort((a, b) => b.count - a.count);
  const pipeline = [...data.pipeline].sort((a, b) => b.count - a.count);
  const dailyTotal = data.daily.reduce((s, r) => s + r.count, 0);
  const pct = data.monthlyGoal > 0 ? Math.round((data.monthlyTotal / data.monthlyGoal) * 100) : 0;

  return (
    // lg+: lock to one landscape screen, no scroll. Smaller screens flow normally.
    <div className="relative flex flex-col gap-3 lg:h-[calc(100dvh-10.5rem)] lg:overflow-hidden">
      <BookingCelebration daily={data.daily} />
      {greet && (
        <div className="fade-in fixed top-20 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-2xl bg-brand-900 px-5 py-3 text-white shadow-xl">
          <p className="font-bold">{greet}</p>
          <button
            type="button"
            onClick={() => setGreet(null)}
            aria-label="Dismiss"
            className="grid size-8 place-items-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}

      {/* Slim header */}
      <div className="flex shrink-0 items-center justify-between gap-4">
        <div className="flex items-baseline gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-brand-900">The board</h1>
          <span className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
            Live leaderboard
          </span>
        </div>
        {isManager && (
          <Link
            href="/game-day"
            className="min-h-9 rounded-full bg-gradient-to-r from-orange-700 to-sky-700 px-4 text-sm font-semibold text-white shadow-sm transition-transform motion-safe:hover:-translate-y-0.5"
          >
            🏆 Game Day
          </Link>
        )}
      </div>

      {/* Team monthly goal — compact horizontal band */}
      <section className="relative shrink-0 overflow-hidden rounded-2xl bg-brand-900 px-5 py-3 text-white shadow-lg">
        <div
          aria-hidden
          className="absolute inset-0 -z-0 opacity-40 [background:radial-gradient(80%_140%_at_100%_0%,var(--color-brand-700),transparent_60%)]"
        />
        <div className="relative flex items-center gap-5">
          <div className="shrink-0">
            <p className="text-[0.65rem] font-semibold tracking-wider text-brand-200 uppercase">
              This month · team goal
            </p>
            <p className="flex items-baseline gap-1.5">
              <span className="text-4xl font-bold tracking-tight tabular-nums">
                {data.monthlyTotal.toLocaleString()}
              </span>
              <span className="text-lg font-semibold text-brand-300">
                / {data.monthlyGoal.toLocaleString()}
              </span>
            </p>
          </div>
          <div className="min-w-0 flex-1">
            <div aria-hidden className="h-2.5 overflow-hidden rounded-full bg-white/15">
              <div
                className="h-full rounded-full bg-gradient-to-r from-accent-400 to-accent-300 transition-all duration-1000"
                style={{ width: `${Math.min(100, pct)}%` }}
              />
            </div>
            <p className="mt-1.5 truncate text-sm font-semibold text-accent-200">
              {monthlyMessage(pct)}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <span className="text-5xl font-bold tracking-tight text-accent-400 tabular-nums">
              {pct}%
            </span>
            <p className="text-[0.65rem] font-medium text-brand-200">
              {Math.max(0, data.monthlyGoal - data.monthlyTotal).toLocaleString()} to go
            </p>
          </div>
        </div>
      </section>

      {/* Three zones fill the rest of the screen */}
      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-12">
        {/* TODAY — compact grid */}
        <section className="flex min-h-0 flex-col lg:col-span-7">
          <div className="flex shrink-0 items-baseline justify-between">
            <h2 className="font-bold text-brand-900">Today</h2>
            <span className="text-xs font-medium text-slate-500">{dailyTotal} bookings</span>
          </div>
          <ul className="mt-2 grid min-h-0 flex-1 grid-cols-2 gap-2 overflow-hidden sm:grid-cols-3 xl:grid-cols-4 lg:[grid-auto-rows:1fr]">
            {data.daily.map((r) => (
              <DailyCell key={r.staffId} r={r} />
            ))}
          </ul>
        </section>

        {/* THIS MONTH — dense ranking */}
        <section className="flex min-h-0 flex-col lg:col-span-3">
          <div className="flex shrink-0 items-baseline justify-between">
            <h2 className="font-bold text-brand-900">This month</h2>
            <span className="text-xs font-medium text-slate-500">{data.monthlyTotal}</span>
          </div>
          <ol className="mt-2 flex min-h-0 flex-1 flex-col divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {monthly.map((r, i) => (
              <li key={r.staffId} className="flex min-h-7 flex-1 items-center gap-2 px-3 lg:min-h-0">
                <span
                  className={cx(
                    "w-4 text-center text-xs font-bold",
                    i === 0 ? "text-accent-800" : i < 3 ? "text-brand-700" : "text-slate-500",
                  )}
                >
                  {i + 1}
                </span>
                <span aria-hidden className={cx("size-2 shrink-0 rounded-full", genderDot(r.gender))} />
                <span className="flex-1 truncate text-sm font-semibold text-brand-900">{r.name}</span>
                {(() => {
                  const t = tierProgress(r.count);
                  return t.top ? (
                    <span className="shrink-0 rounded bg-accent-400/25 px-1.5 text-xs font-bold text-accent-800">
                      ★ Super
                    </span>
                  ) : (
                    <span className="shrink-0 rounded bg-slate-100 px-1.5 text-xs font-semibold whitespace-nowrap text-slate-600 tabular-nums">
                      <span className="font-bold text-brand-700">{t.gap}</span> off {t.next!.short}
                    </span>
                  );
                })()}
                <span className="w-8 text-right text-base font-bold tabular-nums text-brand-900">
                  {r.count}
                </span>
              </li>
            ))}
          </ol>
        </section>

        {/* NEXT 3 MONTHS — dense ranking */}
        <section className="flex min-h-0 flex-col lg:col-span-2">
          <h2 className="shrink-0 font-bold text-brand-900">Next 3 months</h2>
          <ol className="mt-2 flex min-h-0 flex-1 flex-col divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {pipeline.map((r, i) => (
              <li key={r.staffId} className="flex min-h-7 flex-1 items-center gap-2 px-3 lg:min-h-0">
                <span className="w-4 text-center text-xs font-bold text-slate-500">{i + 1}</span>
                <span aria-hidden className={cx("size-2 shrink-0 rounded-full", genderDot(r.gender))} />
                <span className="flex-1 truncate text-sm font-semibold text-brand-900">{r.name}</span>
                <span className="text-base font-bold tabular-nums text-brand-900">{r.count}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
