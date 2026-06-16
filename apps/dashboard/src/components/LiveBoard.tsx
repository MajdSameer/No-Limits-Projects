"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { cx } from "@nlr/ui";

import type { BoardRowDTO, BoardsDTO } from "./Board";
import { BookingCelebration } from "./BookingCelebration";
import { DailyCell } from "./DailyCell";
import { armAudio } from "../lib/celebrate";
import { useLiveRefresh } from "../lib/live";
import { tierProgress } from "../lib/tiers";

/**
 * Full-screen wall leaderboard for /live — the dashboard's three boards (Today,
 * This month, Next 3 months) with no nav or sign-out. Polls the board API live
 * and runs the per-booking celebration (blackout + name + MovePro number).
 */

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

/** Small chip showing how far a rep is off their next incentive tier. */
function TierChip({ count }: { count: number }) {
  const t = tierProgress(count);
  if (t.top) {
    return (
      <span className="shrink-0 rounded bg-accent-400/25 px-1.5 py-0.5 text-xs font-bold text-accent-800">
        ★ Super
      </span>
    );
  }
  return (
    <span className="shrink-0 text-right text-xs font-semibold tabular-nums text-slate-500">
      <span className="text-brand-700">{t.gap}</span>
      <span className="text-slate-400"> → {t.next!.short}</span>
    </span>
  );
}

/** A dense ranked row used by the This-month / Next-3-months columns. */
function RankRow({ r, i, max, tier }: { r: BoardRowDTO; i: number; max?: number; tier?: boolean }) {
  return (
    <li className="flex min-h-8 flex-1 items-center gap-2 px-3 lg:min-h-0">
      <span
        className={cx(
          "w-5 text-center text-sm font-bold",
          i === 0 ? "text-accent-800" : i < 3 ? "text-brand-700" : "text-slate-500",
        )}
      >
        {i + 1}
      </span>
      <span aria-hidden className={cx("size-2 shrink-0 rounded-full", genderDot(r.gender))} />
      <span className="flex-1 truncate text-base font-semibold text-brand-900">{r.name}</span>
      {tier && <TierChip count={r.count} />}
      {!tier && max != null && (
        <div aria-hidden className="hidden h-1.5 w-14 overflow-hidden rounded-full bg-slate-100 xl:block">
          <div
            className="h-full rounded-full bg-brand-400"
            style={{ width: `${Math.round((r.count / max) * 100)}%` }}
          />
        </div>
      )}
      <span className="w-9 text-right text-lg font-bold text-brand-900 tabular-nums">{r.count}</span>
    </li>
  );
}

export function LiveBoard({ initial }: { initial: BoardsDTO }) {
  const [data, setData] = useState<BoardsDTO>(initial);
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
      // Ignore the empty fallback the API returns on a cold-DB hiccup —
      // keep showing the last good board instead of blanking the screen.
      .then((d: BoardsDTO | null) => {
        if (d && Array.isArray(d.daily) && d.daily.length > 0) setData(d);
      })
      .catch(() => undefined)
      .finally(() => {
        inFlight.current = false;
      });
  }, []);
  useLiveRefresh(["bookings", "clock"], refetch);

  const dailyTotal = data.daily.reduce((s, r) => s + r.count, 0);
  const monthly = [...data.monthly].sort((a, b) => b.count - a.count);
  const pipeline = [...data.pipeline].sort((a, b) => b.count - a.count);
  const pct = data.monthlyGoal > 0 ? Math.round((data.monthlyTotal / data.monthlyGoal) * 100) : 0;

  return (
    <main className="ops-bg relative flex h-dvh flex-col gap-3 overflow-hidden p-4 sm:p-5">
      <BookingCelebration daily={data.daily} />

      {data.daily.length === 0 && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-slate-50/95">
          <p className="animate-pulse text-xl font-semibold text-slate-500">Loading the board…</p>
        </div>
      )}

      {/* Team monthly goal band */}
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
            <p className="mt-1.5 truncate text-sm font-semibold text-accent-200">{monthlyMessage(pct)}</p>
          </div>
          <div className="shrink-0 text-right">
            <span className="text-5xl font-bold tracking-tight text-accent-400 tabular-nums">{pct}%</span>
            <p className="text-[0.65rem] font-medium text-brand-200">
              {Math.max(0, data.monthlyGoal - data.monthlyTotal).toLocaleString()} to go
            </p>
          </div>
        </div>
      </section>

      {/* Three zones fill the rest of the screen */}
      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-12">
        {/* TODAY — the leaderboard cards */}
        <section className="flex min-h-0 flex-col lg:col-span-7">
          <div className="flex shrink-0 items-baseline justify-between">
            <h2 className="text-lg font-bold text-brand-900">Today</h2>
            <span className="text-sm font-medium text-slate-500">{dailyTotal} bookings</span>
          </div>
          <ul className="mt-2 grid min-h-0 flex-1 grid-cols-2 gap-2 overflow-hidden sm:grid-cols-3 xl:grid-cols-4 lg:[grid-auto-rows:1fr]">
            {data.daily.map((r) => (
              <DailyCell key={r.staffId} r={r} />
            ))}
          </ul>
        </section>

        {/* THIS MONTH */}
        <section className="flex min-h-0 flex-col lg:col-span-3">
          <div className="flex shrink-0 items-baseline justify-between">
            <h2 className="text-lg font-bold text-brand-900">This month</h2>
            <span className="text-sm font-medium text-slate-500">{data.monthlyTotal}</span>
          </div>
          <ol className="mt-2 flex min-h-0 flex-1 flex-col divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {monthly.map((r, i) => (
              <RankRow key={r.staffId} r={r} i={i} tier />
            ))}
          </ol>
        </section>

        {/* NEXT 3 MONTHS */}
        <section className="flex min-h-0 flex-col lg:col-span-2">
          <h2 className="shrink-0 text-lg font-bold text-brand-900">Next 3 months</h2>
          <ol className="mt-2 flex min-h-0 flex-1 flex-col divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {pipeline.map((r, i) => (
              <RankRow key={r.staffId} r={r} i={i} />
            ))}
          </ol>
        </section>
      </div>
    </main>
  );
}
