"use client";

import confetti from "canvas-confetti";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { cx } from "@nlr/ui";

import { armAudio, celebrateGong, crossedThreshold, GONG_THRESHOLD } from "../lib/celebrate";
import { cellMessage, cellTier } from "../lib/leaderboard-messages";
import { useLiveRefresh } from "../lib/live";
import { sydneyToday } from "../lib/sydney";

export interface BoardRowDTO {
  staffId: string;
  name: string;
  count: number;
  goal: number | null;
  gender: "f" | "m" | "x";
  team: "orange" | "blue" | null;
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
  generatedAtISO: string;
}

function genderSkin(row: BoardRowDTO): string {
  if (row.gender === "f") return "border-pink-300 bg-pink-100";
  if (row.gender === "m") return "border-sky-300 bg-sky-100";
  return "border-slate-200 bg-white";
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

const EMOJI: Record<string, string> = { hit: "🎉", over: "🔥", wild: "🐐" };

/** Compact daily cell — fits a 4-wide grid on a landscape wall display. */
function DailyCell({ r }: { r: BoardRowDTO }) {
  const tier = cellTier(r.count, r.goal);
  const celebrating = tier === "hit" || tier === "over" || tier === "wild";
  const w = r.goal ? Math.min(100, (r.count / r.goal) * 100) : 0;
  return (
    <li
      title={cellMessage(r.staffId, sydneyToday(), tier)}
      className={cx(
        "flex min-h-[4.5rem] flex-col justify-between rounded-xl border p-2.5 lg:min-h-0",
        genderSkin(r),
        celebrating && "ring-2 ring-accent-400",
        tier === "wild" && "ring-accent-500",
      )}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="truncate text-sm font-bold text-brand-900">{r.name}</span>
        {EMOJI[tier] && <span className="text-sm leading-none">{EMOJI[tier]}</span>}
      </div>
      <p className="mt-1 text-3xl leading-none font-bold tracking-tight text-brand-900">
        {r.count}
        <span className="text-base text-slate-600"> / {r.goal ?? "—"}</span>
      </p>
      <div aria-hidden className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/5">
        <div
          className={cx(
            "h-full rounded-full transition-all duration-700",
            celebrating ? "bg-accent-500" : "bg-brand-400",
          )}
          style={{ width: `${w}%` }}
        />
      </div>
    </li>
  );
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
  const gongSeeded = useRef(false);

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

  // Gong + confetti when a rep reaches 3 bookings today (once per rep/day).
  useEffect(() => {
    const key = `nl-gong3-${sydneyToday()}`;
    const seen = new Set<string>(JSON.parse(localStorage.getItem(key) ?? "[]") as string[]);
    const fresh = crossedThreshold(data.daily, seen, GONG_THRESHOLD);
    localStorage.setItem(key, JSON.stringify([...seen]));
    if (!gongSeeded.current) {
      gongSeeded.current = true; // seed silently on first render — no load blast
      return;
    }
    if (fresh.length > 0) celebrateGong();
  }, [data]);

  const refetch = useCallback(() => {
    fetch("/api/boards", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: BoardsDTO | null) => d && setData(d))
      .catch(() => undefined);
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
  const monthlyMax = Math.max(1, ...monthly.map((r) => r.count));

  return (
    // lg+: lock to one landscape screen, no scroll. Smaller screens flow normally.
    <div className="relative flex flex-col gap-3 lg:h-[calc(100dvh-10.5rem)] lg:overflow-hidden">
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
                <div aria-hidden className="hidden h-1.5 w-12 overflow-hidden rounded-full bg-slate-100 xl:block">
                  <div
                    className="h-full rounded-full bg-brand-400"
                    style={{ width: `${Math.round((r.count / monthlyMax) * 100)}%` }}
                  />
                </div>
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
