"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { cx } from "@nlr/ui";

import type { BoardRowDTO, BoardsDTO, InspectorRowDTO } from "./Board";
import { BookingCelebration } from "./BookingCelebration";
import { armAudio } from "../lib/celebrate";
import { cellMessage, cellTier } from "../lib/leaderboard-messages";
import { useLiveRefresh } from "../lib/live";
import { sydneyToday } from "../lib/sydney";
import { tierProgress } from "../lib/tiers";

/**
 * Full-screen DARK wall leaderboard for /live — black background, each rep's box
 * outlined in a "fluorescent" glow in their gender colour (pink ♀ / blue ♂),
 * and every MovePro number they've submitted today listed inside the box. Shows
 * Today / This month (with incentive-tier gaps) / Next 3 months, polls live, and
 * runs the per-booking celebration.
 */

const EMOJI: Record<string, string> = { hit: "🎉", over: "🔥", wild: "🐐" };

/** Fluorescent glow outline for a box, by gender. */
function glow(g: "f" | "m" | "x"): string {
  if (g === "f") return "border border-pink-400 shadow-[0_0_13px_0_rgba(244,114,182,0.6)]";
  if (g === "m") return "border border-sky-400 shadow-[0_0_13px_0_rgba(56,189,248,0.6)]";
  return "border border-slate-400/80 shadow-[0_0_10px_0_rgba(203,213,225,0.4)]";
}

/** Glowing rank dot, by gender. */
function glowDot(g: "f" | "m" | "x"): string {
  if (g === "f") return "bg-pink-400 shadow-[0_0_8px_1px_rgba(244,114,182,0.95)]";
  if (g === "m") return "bg-sky-400 shadow-[0_0_8px_1px_rgba(56,189,248,0.95)]";
  return "bg-slate-300 shadow-[0_0_6px_1px_rgba(255,255,255,0.55)]";
}

function monthlyMessage(pct: number): string {
  if (pct >= 100) return "GOAL SMASHED — what a month 🎉🎉";
  if (pct >= 90) return "Final stretch — bring it home 🏁";
  if (pct >= 75) return "So close to target — keep firing 🔥";
  if (pct >= 50) return "Over halfway there — push on 💪";
  if (pct >= 25) return "Building nicely — keep the leads coming 🚚";
  return "Fresh month, big target — let's chase it 🚀";
}

/** Tidy percentage label: 1 → "1%", 1.5 → "1.5%", 1.75 → "1.75%". */
function pctLabel(pct: number): string {
  return `${Number(pct.toFixed(2))}%`;
}

/**
 * Today's box — name + today's count up top, then (once the sheet pushes
 * revenue) a calm money block under a hairline: the month's NET revenue paired
 * with the rep's rate, and a quiet caption row of labels beneath. Flat single
 * surface — no nested panel — so a wall of 15 reads tidy.
 */
function GlowCell({ r }: { r: BoardRowDTO }) {
  const tier = cellTier(r.count, r.goal);
  const hot = tier === "hit" || tier === "over" || tier === "wild";
  const hasMoney = typeof r.revenue === "number";
  const pct = r.commissionPct ?? 0;
  return (
    <li
      title={cellMessage(r.staffId, sydneyToday(), tier)}
      className={cx(
        "flex min-h-0 flex-col overflow-hidden rounded-xl bg-white/[0.05] p-3",
        hot ? "border-2 border-accent-400 shadow-[0_0_18px_0_rgba(255,212,46,0.65)]" : glow(r.gender),
      )}
    >
      {/* Hero line: name + today's count / goal */}
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-2xl font-bold text-white">
          {r.name}
          {EMOJI[tier] && <span className="ml-1">{EMOJI[tier]}</span>}
        </span>
        <span className="shrink-0 leading-none font-black text-white tabular-nums">
          <span className="text-5xl">{r.count}</span>
          <span className="text-2xl font-semibold text-white/35">/{r.goal ?? "—"}</span>
        </span>
      </div>

      {/* Money block — revenue + rate on a baseline, quiet labels beneath */}
      {hasMoney && (
        <div className="mt-auto border-t border-white/10 pt-2">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-2xl leading-none font-black text-emerald-300 tabular-nums xl:text-[1.7rem]">
              {moneyCompact(r.revenue!)}
            </span>
            <span
              className={cx(
                "shrink-0 text-lg leading-none font-bold tabular-nums xl:text-xl",
                pct > 0 ? "text-accent-300" : "text-white/30",
              )}
            >
              {pctLabel(pct)}
            </span>
          </div>
          <div className="mt-1.5 flex items-baseline justify-between gap-2 leading-none">
            <span className="text-[0.65rem] font-semibold tracking-[0.12em] text-emerald-300/45 uppercase">
              Revenue
            </span>
            {typeof r.commission === "number" && (
              <span className="text-sm font-semibold text-white/55 tabular-nums">
                ~${Math.round(r.commission).toLocaleString()}{" "}
                <span className="text-[0.6rem] font-medium tracking-wide text-white/35 uppercase">comm</span>
              </span>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

/** A site inspector's box — violet glow, today's count, and each job number
 * with the sales rep whose customer the inspection is for. */
function InspectorCell({ r }: { r: InspectorRowDTO }) {
  return (
    <li className="flex min-h-0 flex-col gap-1 overflow-hidden rounded-xl border border-violet-400 bg-violet-500/[0.07] p-2.5 shadow-[0_0_13px_0_rgba(167,139,250,0.55)]">
      <div className="flex items-baseline justify-between gap-2">
        <span className="flex min-w-0 items-baseline gap-1.5">
          <span className="truncate text-xl font-bold text-white">{r.name}</span>
          <span className="shrink-0 text-[0.6rem] font-bold tracking-[0.15em] text-violet-300 uppercase">
            Inspector
          </span>
        </span>
        <span className="shrink-0 text-3xl leading-none font-bold text-white tabular-nums">{r.count}</span>
      </div>
      {r.jobs.length > 0 && (
        <div className="flex min-h-0 flex-wrap content-start gap-1 overflow-hidden">
          {r.jobs.map((j, i) => (
            <span
              key={`${j.code}-${i}`}
              className="rounded bg-violet-500/15 px-1.5 py-px font-mono text-[0.7rem] leading-tight font-medium tracking-wide text-violet-100"
            >
              {j.code}
              {j.forRep && <span className="text-violet-300/80"> · {j.forRep}</span>}
            </span>
          ))}
        </div>
      )}
    </li>
  );
}

/** Chip showing how many bookings a rep is off their next incentive tier. */
function TierChip({ count }: { count: number }) {
  const t = tierProgress(count);
  if (t.top) {
    return (
      <span className="shrink-0 rounded bg-accent-400/25 px-2 py-0.5 text-sm font-bold text-accent-300">
        ★ Super Bonus
      </span>
    );
  }
  return (
    <span className="shrink-0 rounded bg-white/10 px-2 py-0.5 text-sm font-semibold whitespace-nowrap text-white/70 tabular-nums">
      <span className="font-bold text-accent-300">{t.gap}</span> off {t.next!.name}
    </span>
  );
}

/** Compact dollars for the wall: exact under $10k ($8,450), abbreviated above ($42.3k). */
function moneyCompact(n: number): string {
  const v = Math.round(n);
  if (Math.abs(v) >= 10000) {
    const k = v / 1000;
    return `$${k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)}k`;
  }
  return `$${v.toLocaleString()}`;
}

/** A dense ranked row (This month / Next 3 months). */
function RankRow({ r, i, tier }: { r: BoardRowDTO; i: number; tier?: boolean }) {
  return (
    <li className="flex min-h-0 flex-1 items-center gap-2 overflow-hidden px-3">
      <span
        className={cx(
          "w-5 text-center text-sm font-bold",
          i === 0 ? "text-accent-400" : i < 3 ? "text-brand-200" : "text-white/40",
        )}
      >
        {i + 1}
      </span>
      <span aria-hidden className={cx("size-2.5 shrink-0 rounded-full", glowDot(r.gender))} />
      <span className="flex-1 truncate text-base font-semibold text-white">{r.name}</span>
      {tier && <TierChip count={r.count} />}
      <span className="w-9 text-right text-lg font-bold text-white tabular-nums">{r.count}</span>
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
  const dailyTarget = data.dailyTarget ?? 0;
  const dailyPct = dailyTarget > 0 ? Math.round((dailyTotal / dailyTarget) * 100) : 0;
  const dailyHit = dailyTarget > 0 && dailyTotal >= dailyTarget;

  return (
    <main className="relative flex h-dvh flex-col gap-3 overflow-hidden bg-black p-4 text-white sm:p-5">
      <BookingCelebration daily={data.daily} inspectors={data.inspectors} />

      {data.daily.length === 0 && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-black/95">
          <p className="animate-pulse text-xl font-semibold text-white/60">Loading the board…</p>
        </div>
      )}

      {/* Top band: prominent TODAY number (left) + team monthly goal (right) */}
      <div className="flex shrink-0 items-stretch gap-3">
        {/* TODAY — the hero number, biggest thing on the wall */}
        <section
          className={cx(
            "relative flex shrink-0 items-center gap-5 overflow-hidden rounded-2xl px-6 py-3 shadow-lg",
            dailyHit
              ? "border-2 border-accent-400 bg-accent-400/10 shadow-[0_0_28px_-4px_rgba(255,212,46,0.7)]"
              : "border border-accent-400/40 bg-white/[0.04]",
          )}
        >
          <div
            aria-hidden
            className="absolute inset-0 -z-0 [background:radial-gradient(75%_120%_at_0%_0%,rgba(255,212,46,0.16),transparent_65%)]"
          />
          <div className="relative">
            <p className="text-[0.65rem] font-semibold tracking-[0.2em] text-accent-300/80 uppercase">
              Today
            </p>
            <p className="flex items-baseline gap-2 leading-none">
              <span className="font-display text-7xl font-black tracking-tight text-white tabular-nums">
                {dailyTotal}
              </span>
              <span className="text-3xl font-bold text-white/40 tabular-nums">
                / {dailyTarget || "—"}
              </span>
            </p>
            <p className="mt-1 text-xs font-semibold text-white/55">
              bookings · <span className="text-accent-300">{data.activeToday ?? 0}</span> on shift
            </p>
          </div>
          {dailyTarget > 0 && (
            <div className="relative flex h-full flex-col justify-center">
              <span className="text-4xl font-bold text-accent-400 tabular-nums">
                {dailyHit ? "✓" : `${dailyPct}%`}
              </span>
            </div>
          )}
        </section>

        {/* Team monthly goal band */}
        <section className="relative flex-1 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 shadow-lg">
          <div
            aria-hidden
            className="absolute inset-0 -z-0 opacity-60 [background:radial-gradient(80%_140%_at_100%_0%,rgba(255,212,46,0.12),transparent_60%)]"
          />
          <div className="relative flex h-full items-center gap-5">
            <div className="shrink-0">
              <p className="text-[0.65rem] font-semibold tracking-wider text-white/50 uppercase">
                This month · team goal
              </p>
              <p className="flex items-baseline gap-1.5">
                <span className="text-4xl font-bold tracking-tight tabular-nums">
                  {data.monthlyTotal.toLocaleString()}
                </span>
                <span className="text-lg font-semibold text-white/50">
                  / {data.monthlyGoal.toLocaleString()}
                </span>
              </p>
            </div>
            <div className="min-w-0 flex-1">
              <div aria-hidden className="h-2.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-accent-400 to-accent-300 shadow-[0_0_12px_rgba(255,212,46,0.7)] transition-all duration-1000"
                  style={{ width: `${Math.min(100, pct)}%` }}
                />
              </div>
              <p className="mt-1.5 truncate text-sm font-semibold text-accent-300">{monthlyMessage(pct)}</p>
            </div>
            <div className="shrink-0 text-right">
              <span className="text-5xl font-bold tracking-tight text-accent-400 tabular-nums">{pct}%</span>
              <p className="text-[0.65rem] font-medium text-white/50">
                {Math.max(0, data.monthlyGoal - data.monthlyTotal).toLocaleString()} to go
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* Three zones fill the rest of the screen */}
      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-12">
        {/* TODAY — glowing boxes with each rep's MovePro numbers */}
        <section className="flex min-h-0 flex-col lg:col-span-7">
          <div className="flex shrink-0 items-baseline justify-between">
            <h2 className="text-lg font-bold text-white">Today</h2>
            <span className="text-sm font-medium text-white/50">
              {dailyTarget > 0 ? `team target ${dailyTarget}` : `${dailyTotal} bookings`}
            </span>
          </div>
          {/* p-1 + no overflow-hidden so the fluorescent glow isn't clipped */}
          <ul className="mt-2 grid min-h-0 flex-1 grid-cols-3 gap-3 p-1 sm:grid-cols-4 [grid-auto-rows:1fr]">
            {data.daily.map((r) => (
              <GlowCell key={r.staffId} r={r} />
            ))}
          </ul>

          {/* Dedicated Site Inspectors strip — their own boxes below the reps. */}
          {data.inspectors.length > 0 && (
            <div className="mt-3 shrink-0">
              <div className="flex items-center gap-3 px-1">
                <span className="text-sm font-bold tracking-[0.2em] text-violet-300 uppercase">
                  Site Inspectors
                </span>
                <span aria-hidden className="h-px flex-1 bg-violet-400/30" />
                <span className="text-sm font-medium text-white/50">today</span>
              </div>
              <ul className="mt-2 grid grid-cols-2 gap-3 p-1 sm:grid-cols-3 [grid-auto-rows:1fr]">
                {data.inspectors.map((r) => (
                  <InspectorCell key={r.id} r={r} />
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* THIS MONTH — with incentive-tier gaps */}
        <section className="flex min-h-0 flex-col lg:col-span-3">
          <div className="flex shrink-0 items-baseline justify-between">
            <h2 className="text-lg font-bold text-white">This month</h2>
            <span className="text-sm font-medium text-white/50">{data.monthlyTotal}</span>
          </div>
          <ol className="mt-2 flex min-h-0 flex-1 flex-col divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
            {monthly.map((r, i) => (
              <RankRow key={r.staffId} r={r} i={i} tier />
            ))}
          </ol>
        </section>

        {/* NEXT 3 MONTHS */}
        <section className="flex min-h-0 flex-col lg:col-span-2">
          <h2 className="shrink-0 text-lg font-bold text-white">Next 3 months</h2>
          <ol className="mt-2 flex min-h-0 flex-1 flex-col divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
            {pipeline.map((r, i) => (
              <RankRow key={r.staffId} r={r} i={i} />
            ))}
          </ol>
        </section>
      </div>
    </main>
  );
}
