"use client";

import confetti from "canvas-confetti";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { cx } from "@nlr/ui";

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

/** Gender pink/blue cell tint (Game Day colours live on their own page). */
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
    <div>
      {greet && (
        <div className="fade-in mb-5 flex items-center justify-between gap-4 rounded-2xl bg-brand-900 px-5 py-4 text-white shadow-lg">
          <p className="text-lg font-bold">{greet}</p>
          <button
            type="button"
            onClick={() => setGreet(null)}
            aria-label="Dismiss"
            className="grid size-9 place-items-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">Leaderboard</p>
          <h1 className="mt-1 text-4xl font-bold tracking-tight text-brand-900">The board</h1>
        </div>
        {isManager && (
          <Link
            href="/game-day"
            className="min-h-10 rounded-full bg-gradient-to-r from-orange-700 to-sky-700 px-5 text-sm font-semibold text-white shadow-sm transition-transform motion-safe:hover:-translate-y-0.5"
          >
            🏆 Game Day
          </Link>
        )}
      </div>

      {/* ── TEAM MONTHLY GOAL — the digital display ─────────────────── */}
      <section className="relative mt-5 overflow-hidden rounded-3xl bg-brand-900 p-6 text-white shadow-lg sm:p-8">
        <div
          aria-hidden
          className="absolute inset-0 -z-0 opacity-40 [background:radial-gradient(80%_120%_at_100%_0%,var(--color-brand-700),transparent_60%)]"
        />
        <div className="relative flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
          <div>
            <p className="text-xs font-semibold tracking-wider text-brand-200 uppercase">
              This month · team goal
            </p>
            <p className="mt-2 flex items-baseline gap-2">
              <span className="text-6xl font-bold tracking-tight text-white tabular-nums sm:text-7xl">
                {data.monthlyTotal.toLocaleString()}
              </span>
              <span className="text-2xl font-semibold text-brand-300">
                / {data.monthlyGoal.toLocaleString()}
              </span>
            </p>
          </div>
          <div className="text-right">
            <span className="text-6xl font-bold tracking-tight text-accent-400 tabular-nums sm:text-7xl">
              {pct}%
            </span>
            <p className="mt-1 text-sm font-medium text-brand-200">
              {(data.monthlyGoal - data.monthlyTotal).toLocaleString()} to go
            </p>
          </div>
        </div>
        <div aria-hidden className="relative mt-5 h-3 overflow-hidden rounded-full bg-white/15">
          <div
            className="h-full rounded-full bg-gradient-to-r from-accent-400 to-accent-300 transition-all duration-1000"
            style={{ width: `${Math.min(100, pct)}%` }}
          />
        </div>
        <p className="relative mt-3 text-center text-sm font-semibold text-accent-200">
          {monthlyMessage(pct)}
        </p>
      </section>

      {/* ── DAILY (left)  +  MONTHLY RANKING (right) ────────────────── */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Today */}
        <section>
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-bold text-brand-900">Today</h2>
            <span className="text-sm font-medium text-slate-500">{dailyTotal} bookings</span>
          </div>
          {dailyTotal === 0 && (
            <p className="mt-4 text-sm font-medium text-slate-500">No bookings yet today — be the first 🎉</p>
          )}
          <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {data.daily.map((r) => {
              const tier = cellTier(r.count, r.goal);
              const celebrating = tier === "hit" || tier === "over" || tier === "wild";
              const w = r.goal ? Math.min(100, (r.count / r.goal) * 100) : 0;
              return (
                <li
                  key={r.staffId}
                  className={cx(
                    "rounded-2xl border p-4 shadow-sm transition-all duration-300 motion-safe:hover:-translate-y-0.5",
                    genderSkin(r),
                    celebrating && "ring-2 ring-accent-400",
                    tier === "wild" && "ring-accent-500",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-bold text-brand-900">{r.name}</span>
                    {tier === "hit" && <span className="text-sm">🎉</span>}
                    {tier === "over" && <span className="text-sm">🔥</span>}
                    {tier === "wild" && <span className="text-sm">🐐</span>}
                  </div>
                  <p className="mt-1 text-4xl font-bold tracking-tight text-brand-900">
                    {r.count}
                    <span className="text-xl text-slate-500"> / {r.goal ?? "—"}</span>
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
                  <p
                    className={cx(
                      "mt-2 text-xs font-semibold",
                      tier === "wild" ? "text-accent-800" : celebrating ? "text-brand-700" : "text-slate-600",
                    )}
                  >
                    {cellMessage(r.staffId, sydneyToday(), tier)}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>

        {/* This month ranking */}
        <section>
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-bold text-brand-900">This month</h2>
            <span className="text-sm font-medium text-slate-500">{data.monthlyTotal} total</span>
          </div>
          <ol className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {monthly.map((r, i) => (
              <li
                key={r.staffId}
                className="flex items-center gap-3 border-b border-slate-100 px-4 py-2.5 transition-colors last:border-0 hover:bg-slate-50"
              >
                <span
                  className={cx(
                    "w-6 text-center text-sm font-bold",
                    i === 0 ? "text-accent-800" : i < 3 ? "text-brand-700" : "text-slate-500",
                  )}
                >
                  {i + 1}
                </span>
                <span aria-hidden className={cx("size-2.5 rounded-full", genderDot(r.gender))} />
                <span className="flex-1 truncate font-semibold text-brand-900">{r.name}</span>
                <div aria-hidden className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-slate-100 sm:block">
                  <div
                    className="h-full rounded-full bg-brand-400"
                    style={{ width: `${Math.round((r.count / monthlyMax) * 100)}%` }}
                  />
                </div>
                <span className="w-10 text-right text-xl font-bold tabular-nums text-brand-900">
                  {r.count}
                </span>
              </li>
            ))}
          </ol>
        </section>
      </div>

      {/* ── NEXT 3 MONTHS (full width) ──────────────────────────────── */}
      <section className="mt-6">
        <h2 className="text-lg font-bold text-brand-900">Next 3 months</h2>
        <p className="text-sm font-medium text-slate-500">Booked moves landing in the next quarter</p>
        <ol className="mt-4 grid gap-x-6 gap-y-1 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm sm:grid-cols-2 lg:grid-cols-3">
          {pipeline.map((r, i) => (
            <li key={r.staffId} className="flex items-center gap-3 rounded-xl px-3 py-2 transition-colors hover:bg-slate-50">
              <span className="w-5 text-center text-sm font-bold text-slate-500">{i + 1}</span>
              <span aria-hidden className={cx("size-2.5 rounded-full", genderDot(r.gender))} />
              <span className="flex-1 truncate font-semibold text-brand-900">{r.name}</span>
              <span className="text-lg font-bold tabular-nums text-brand-900">{r.count}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
