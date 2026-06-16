"use client";

import { cx } from "@nlr/ui";

import type { BoardRowDTO } from "./Board";
import { cellMessage, cellTier } from "../lib/leaderboard-messages";
import { sydneyToday } from "../lib/sydney";

export function genderSkin(row: BoardRowDTO): string {
  if (row.gender === "f") return "border-pink-300 bg-pink-100";
  if (row.gender === "m") return "border-sky-300 bg-sky-100";
  return "border-slate-200 bg-white";
}

const EMOJI: Record<string, string> = { hit: "🎉", over: "🔥", wild: "🐐" };

/** Daily leaderboard cell — the exact card used on the dashboard board. */
export function DailyCell({ r }: { r: BoardRowDTO }) {
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
