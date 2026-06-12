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
          <p className="text-xs font-bold tracking-[0.2em] text-slate-600 uppercase">Leaderboard</p>
          <h1 className="font-display mt-1 text-4xl font-bold tracking-wide text-brand-900 uppercase">The board</h1>
        </div>
        <div role="tablist" aria-label="Board period" className="flex gap-1 rounded-full bg-slate-100 p-1">
          {(Object.keys(TAB_LABEL) as Tab[]).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={cx(
                "min-h-9 rounded-full px-4 text-sm font-semibold transition-all duration-200",
                tab === t ? "bg-white text-brand-900 shadow-sm" : "text-slate-600 hover:text-brand-900",
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
            <p className="text-sm font-medium text-slate-500">{showYesterday ? "Yesterday" : "Today"} · {total(dailyRows)} bookings</p>
            <button
              type="button"
              onClick={() => setShowYesterday((v) => !v)}
              className="min-h-10 rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition-colors hover:border-brand-300 hover:text-brand-900"
            >
              {showYesterday ? "Show today" : "Show yesterday"}
            </button>
          </div>

          {total(dailyRows) === 0 && (
            <p className="mt-8 text-sm font-medium text-slate-500">
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
                    "rounded-2xl border p-5 shadow-sm transition-all duration-300",
                    done ? "border-accent-400 bg-accent-400" : "border-slate-200 bg-white motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-md",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={cx("truncate font-bold", done ? "text-brand-950" : "text-brand-900")}>
                      {r.name}
                    </span>
                    {done && (
                      <span aria-label="goal hit" className="font-mono text-[0.6rem] font-bold tracking-widest uppercase">
                        🎉 Done
                      </span>
                    )}
                  </div>
                  <p className={cx("font-display mt-2 text-5xl font-bold tracking-wide", done ? "text-brand-950" : "text-brand-900")}>
                    {r.count}
                    <span className={cx("text-2xl", done ? "text-brand-800" : "text-slate-500")}>
                      {" "}/ {r.goal ?? "—"}
                    </span>
                  </p>
                  <div aria-hidden className={cx("mt-3 h-1.5 overflow-hidden rounded-full", done ? "bg-brand-950/15" : "bg-slate-100")}>
                    <div
                      className={cx("h-full rounded-full transition-all duration-700", done ? "bg-brand-950" : "bg-accent-400")}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <ol className="mt-6 max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {(tab === "monthly" ? data.monthly : data.pipeline).map((r, i) => (
            <li
              key={r.staffId}
              className="flex items-center gap-4 border-b border-slate-100 px-5 py-3 transition-colors last:border-0 hover:bg-slate-50"
            >
              <span className="font-display w-10 text-2xl font-bold text-accent-700">{i + 1}</span>
              <span className="flex-1 truncate font-bold text-brand-900">{r.name}</span>
              <span className="font-display text-3xl font-bold tracking-wide text-brand-900">
                {r.count}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
