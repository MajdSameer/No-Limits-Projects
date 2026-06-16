"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { BoardsDTO } from "./Board";
import { BookingCelebration } from "./BookingCelebration";
import { DailyCell } from "./DailyCell";
import { armAudio } from "../lib/celebrate";
import { useLiveRefresh } from "../lib/live";

/**
 * Full-screen wall leaderboard for /live — the exact dashboard "Today" cards,
 * with nothing else (no nav, no sign-out). Polls the board API live and runs
 * the per-booking celebration (blackout + name + MovePro number).
 */
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
      .then((d: BoardsDTO | null) => d && setData(d))
      .catch(() => undefined)
      .finally(() => {
        inFlight.current = false;
      });
  }, []);
  useLiveRefresh(["bookings", "clock"], refetch);

  const total = data.daily.reduce((s, r) => s + r.count, 0);
  const updated = new Date(data.generatedAtISO).toLocaleTimeString("en-AU", {
    timeZone: "Australia/Sydney",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <main className="ops-bg flex min-h-dvh flex-col p-4 sm:p-6">
      <BookingCelebration daily={data.daily} />

      <header className="mb-4 flex shrink-0 items-center justify-between gap-4">
        <div className="flex items-baseline gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-brand-900 sm:text-3xl">Today</h1>
          <span className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
            Live leaderboard
          </span>
        </div>
        <div className="text-right">
          <span className="text-3xl font-black text-brand-900 tabular-nums sm:text-4xl">{total}</span>
          <span className="ml-2 text-sm font-medium text-slate-500">bookings today · {updated}</span>
        </div>
      </header>

      <ul className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 [grid-auto-rows:1fr]">
        {data.daily.map((r) => (
          <DailyCell key={r.staffId} r={r} />
        ))}
      </ul>
    </main>
  );
}
