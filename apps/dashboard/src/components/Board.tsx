"use client";

import confetti from "canvas-confetti";
import { useCallback, useEffect, useState } from "react";

import { cx } from "@nlr/ui";

import { useLiveRefresh } from "../lib/live";
import { sydneyToday } from "../lib/sydney";

export interface BoardRowDTO {
  staffId: string;
  name: string;
  count: number;
  goal: number | null;
}

export interface BoardsDTO {
  daily: BoardRowDTO[];
  yesterday: BoardRowDTO[];
  monthly: BoardRowDTO[];
  pipeline: BoardRowDTO[];
  generatedAtISO: string;
}

type Tab = "daily" | "monthly" | "pipeline";

const TAB_LABEL: Record<Tab, string> = {
  daily: "Daily",
  monthly: "Monthly",
  pipeline: "Next 3 months",
};

/** Fire goal confetti once per rep per Sydney day (client-side memory). */
function celebrateNewGoalHits(rows: BoardRowDTO[]) {
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
    confetti({ particleCount: 140, spread: 90, origin: { y: 0.4 }, colors: ["#ffd42e", "#fff389", "#f4f1e8"] });
  }
}

export function Board({ initial }: { initial: BoardsDTO }) {
  const [data, setData] = useState<BoardsDTO>(initial);
  const [tab, setTab] = useState<Tab>("daily");
  const [showYesterday, setShowYesterday] = useState(false);

  const refetch = useCallback(() => {
    fetch("/api/boards", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: BoardsDTO | null) => {
        if (d) setData(d);
      })
      .catch(() => undefined);
  }, []);
  useLiveRefresh(["bookings"], refetch);

  useEffect(() => celebrateNewGoalHits(data.daily), [data]);

  const dailyRows = showYesterday ? data.yesterday : data.daily;
  const total = (rows: BoardRowDTO[]) => rows.reduce((sum, r) => sum + r.count, 0);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs font-bold tracking-[0.3em] text-accent-400 uppercase">
            Leaderboard
          </p>
          <h1 className="font-display mt-1 text-4xl font-bold tracking-wide text-manila-100 uppercase">
            The board
          </h1>
        </div>
        <div role="tablist" aria-label="Board period" className="flex gap-1">
          {(Object.keys(TAB_LABEL) as Tab[]).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={cx(
                "min-h-11 rounded-full border px-4 font-mono text-xs font-bold tracking-widest uppercase",
                tab === t
                  ? "border-accent-400 bg-accent-400 text-ink-950"
                  : "border-brand-800 text-manila-200 hover:border-accent-400",
              )}
            >
              {TAB_LABEL[t]}
            </button>
          ))}
        </div>
      </div>

      {tab === "daily" ? (
        <>
          <div className="mt-5 flex items-center justify-between gap-4">
            <p className="font-mono text-xs tracking-widest text-brand-300 uppercase">
              {showYesterday ? "Yesterday" : "Today"} · {total(dailyRows)} bookings
            </p>
            <button
              type="button"
              onClick={() => setShowYesterday((v) => !v)}
              className="min-h-11 rounded-full border border-brand-800 px-4 font-mono text-xs font-bold tracking-widest text-manila-200 uppercase hover:border-accent-400"
            >
              {showYesterday ? "Show today" : "Show yesterday"}
            </button>
          </div>

          {total(dailyRows) === 0 && (
            <p className="mt-8 font-mono text-sm tracking-widest text-brand-300 uppercase">
              No bookings yet {showYesterday ? "yesterday" : "today"} — be the first 🎉
            </p>
          )}

          <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {dailyRows.map((r) => {
              const done = r.goal !== null && r.count >= r.goal;
              const pct = r.goal ? Math.min(100, (r.count / r.goal) * 100) : 0;
              return (
                <li
                  key={r.staffId}
                  className={cx(
                    "border p-4 transition-colors",
                    done ? "border-accent-400 bg-accent-400 text-ink-950" : "border-brand-800 bg-ink-900",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={cx("truncate font-bold", done ? "text-ink-950" : "text-manila-100")}>
                      {r.name}
                    </span>
                    {done && (
                      <span aria-label="goal hit" className="font-mono text-[0.6rem] font-bold tracking-widest uppercase">
                        🎉 Done
                      </span>
                    )}
                  </div>
                  <p className={cx("font-display mt-2 text-5xl font-bold tracking-wide", done ? "text-ink-950" : "text-manila-100")}>
                    {r.count}
                    <span className={cx("text-2xl", done ? "text-brand-900" : "text-brand-500")}>
                      {" "}/ {r.goal ?? "—"}
                    </span>
                  </p>
                  <div aria-hidden className={cx("mt-3 h-1.5", done ? "bg-ink-950/20" : "bg-ink-950")}>
                    <div
                      className={cx("h-full transition-all duration-700", done ? "bg-ink-950" : "bg-accent-400")}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <ol className="mt-6 max-w-2xl">
          {(tab === "monthly" ? data.monthly : data.pipeline).map((r, i) => (
            <li
              key={r.staffId}
              className="flex items-center gap-4 border-b border-brand-800 py-2.5"
            >
              <span className="font-display w-10 text-2xl font-bold text-accent-400">{i + 1}</span>
              <span className="flex-1 truncate font-bold text-manila-100">{r.name}</span>
              <span className="font-display text-3xl font-bold tracking-wide text-manila-100">
                {r.count}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
