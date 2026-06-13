"use client";

import confetti from "canvas-confetti";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import { cx } from "@nlr/ui";

import { assignNextLead } from "../app/actions/leads";
import { setGameDay } from "../app/actions/manage";
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
  generatedAtISO: string;
}

type Tab = "daily" | "monthly" | "pipeline";
const TAB_LABEL: Record<Tab, string> = { daily: "Daily", monthly: "Monthly", pipeline: "Next 3 months" };

/** Card skin: Game Day team colours win; otherwise gender pink/blue. */
function cellSkin(row: BoardRowDTO, gameDay: boolean): string {
  if (gameDay && row.team) {
    return row.team === "orange"
      ? "border-orange-300 bg-orange-100"
      : "border-sky-300 bg-sky-100";
  }
  if (row.gender === "f") return "border-pink-300 bg-pink-100";
  if (row.gender === "m") return "border-sky-300 bg-sky-100";
  return "border-slate-200 bg-white";
}

function fireGoalConfetti(rows: BoardRowDTO[], gameDay: boolean) {
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
      colors: gameDay ? ["#fb923c", "#38bdf8", "#ffd42e"] : ["#ffd42e", "#fff389", "#f472b6", "#38bdf8"],
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
  const [tab, setTab] = useState<Tab>("daily");
  const [showYesterday, setShowYesterday] = useState(false);
  const [greet, setGreet] = useState<string | null>(welcome ?? null);
  const [toast, setToast] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const greetFired = useRef(false);

  const refetch = useCallback(() => {
    fetch("/api/boards", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: BoardsDTO | null) => d && setData(d))
      .catch(() => undefined);
  }, []);
  useLiveRefresh(["bookings", "clock"], refetch);

  useEffect(() => fireGoalConfetti(data.daily, data.gameDay), [data]);

  // Greeting: confetti pop + auto-dismiss.
  useEffect(() => {
    if (!greet || greetFired.current) return;
    greetFired.current = true;
    // Drop ?welcome=1 so a refresh doesn't re-greet.
    if (window.location.search.includes("welcome")) {
      window.history.replaceState({}, "", "/");
    }
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      confetti({ particleCount: 70, spread: 60, origin: { y: 0.2 }, colors: ["#ffd42e", "#fff389"] });
    }
    const t = setTimeout(() => setGreet(null), 6000);
    return () => clearTimeout(t);
  }, [greet]);

  const flashToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const dailyRows = showYesterday ? data.yesterday : data.daily;
  const total = (rows: BoardRowDTO[]) => rows.reduce((s, r) => s + r.count, 0);

  const orange = data.daily.filter((r) => r.team === "orange").reduce((s, r) => s + r.count, 0);
  const blue = data.daily.filter((r) => r.team === "blue").reduce((s, r) => s + r.count, 0);

  const doAssign = () =>
    startTransition(async () => {
      const r = await assignNextLead();
      flashToast(r.assignedTo ? `Lead → ${r.assignedTo} 🎯` : (r.error ?? "Couldn't assign"));
      refetch();
    });

  const toggleGameDay = () =>
    startTransition(async () => {
      await setGameDay(!data.gameDay);
      refetch();
    });

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
          <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
            {data.gameDay ? "🏆 Game Day" : "Leaderboard"}
          </p>
          <h1 className="mt-1 text-4xl font-bold tracking-tight text-brand-900">The board</h1>
        </div>
        <div className="flex items-center gap-2">
          {isManager && (
            <button
              type="button"
              onClick={toggleGameDay}
              disabled={pending}
              className={cx(
                "min-h-9 rounded-full px-4 text-sm font-semibold transition-all",
                data.gameDay
                  ? "bg-gradient-to-r from-orange-500 to-sky-500 text-white shadow-sm"
                  : "border border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:text-brand-900",
              )}
            >
              {data.gameDay ? "Game Day: ON" : "Start Game Day"}
            </button>
          )}
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
      </div>

      {/* Game Day scoreboard */}
      {data.gameDay && tab === "daily" && !showYesterday && (
        <div className="fade-in mt-5 grid grid-cols-2 gap-3 sm:gap-4">
          <div className="rounded-2xl border-2 border-orange-300 bg-orange-50 p-4 text-center">
            <p className="text-xs font-bold tracking-widest text-orange-700 uppercase">🟠 Orange</p>
            <p className="mt-1 text-5xl font-bold tracking-tight text-orange-600">{orange}</p>
          </div>
          <div className="rounded-2xl border-2 border-sky-300 bg-sky-50 p-4 text-center">
            <p className="text-xs font-bold tracking-widest text-sky-700 uppercase">🔵 Blue</p>
            <p className="mt-1 text-5xl font-bold tracking-tight text-sky-600">{blue}</p>
          </div>
          <p className="col-span-2 text-center text-sm font-semibold text-slate-500">
            {orange === blue
              ? "Dead heat — pick it up! 🤝"
              : `${orange > blue ? "Orange" : "Blue"} leads by ${Math.abs(orange - blue)} 🚚💨`}
          </p>
        </div>
      )}

      {/* Live lead allocation */}
      {tab === "daily" && !showYesterday && (
        <AllocationPanel
          allocation={data.allocation}
          gameDay={data.gameDay}
          board={data.daily}
          pending={pending}
          onAssign={doAssign}
        />
      )}

      {tab === "daily" ? (
        <>
          <div className="mt-6 flex items-center justify-between gap-4">
            <p className="text-sm font-medium text-slate-500">
              {showYesterday ? "Yesterday" : "Today"} · {total(dailyRows)} bookings
            </p>
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

          <ul className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {dailyRows.map((r) => {
              const tier = cellTier(r.count, r.goal);
              const celebrating = tier === "hit" || tier === "over" || tier === "wild";
              const pct = r.goal ? Math.min(100, (r.count / r.goal) * 100) : 0;
              return (
                <li
                  key={r.staffId}
                  className={cx(
                    "rounded-2xl border p-5 shadow-sm transition-all duration-300 motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-md",
                    cellSkin(r, data.gameDay),
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
                  <p className="mt-2 text-5xl font-bold tracking-tight text-brand-900">
                    {r.count}
                    <span className="text-2xl text-slate-500"> / {r.goal ?? "—"}</span>
                  </p>
                  <div aria-hidden className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/5">
                    <div
                      className={cx(
                        "h-full rounded-full transition-all duration-700",
                        celebrating ? "bg-accent-500" : "bg-brand-400",
                      )}
                      style={{ width: `${pct}%` }}
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
        </>
      ) : (
        <ol className="mt-6 max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {(tab === "monthly" ? data.monthly : data.pipeline).map((r, i) => (
            <li
              key={r.staffId}
              className="flex items-center gap-4 border-b border-slate-100 px-5 py-3 transition-colors last:border-0 hover:bg-slate-50"
            >
              <span className="w-10 text-2xl font-bold text-accent-700">{i + 1}</span>
              <span
                aria-hidden
                className={cx(
                  "size-2.5 rounded-full",
                  r.gender === "f" ? "bg-pink-400" : r.gender === "m" ? "bg-sky-400" : "bg-slate-300",
                )}
              />
              <span className="flex-1 truncate font-bold text-brand-900">{r.name}</span>
              <span className="text-3xl font-bold tracking-tight text-brand-900">{r.count}</span>
            </li>
          ))}
        </ol>
      )}

      {toast && (
        <div className="fade-in fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full bg-brand-900 px-5 py-2.5 text-sm font-semibold text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

function AllocationPanel({
  allocation,
  gameDay,
  board,
  pending,
  onAssign,
}: {
  allocation: BoardsDTO["allocation"];
  gameDay: boolean;
  board: BoardRowDTO[];
  pending: boolean;
  onAssign: () => void;
}) {
  const genderOf = (id: string) => board.find((b) => b.staffId === id)?.gender ?? "x";
  const next = allocation.eligible.find((e) => e.staffId === allocation.nextUp);

  return (
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">Live lead allocation</p>
          <p className="mt-0.5 text-sm font-medium text-slate-600">
            {allocation.eligible.length === 0
              ? "Nobody clocked in & off-break right now"
              : next
                ? `Next lead is ${next.name}'s 🎯`
                : "Ready"}
            {" · "}
            {allocation.totalLeadsToday} leads today
          </p>
        </div>
        <button
          type="button"
          onClick={onAssign}
          disabled={pending || allocation.eligible.length === 0}
          className="min-h-10 rounded-full bg-brand-900 px-5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-brand-800 disabled:opacity-50 motion-safe:hover:-translate-y-0.5"
        >
          Assign next lead
        </button>
      </div>

      {allocation.eligible.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-2">
          {allocation.eligible.map((e) => {
            const g = genderOf(e.staffId);
            const isNext = e.staffId === allocation.nextUp;
            return (
              <li
                key={e.staffId}
                className={cx(
                  "flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors",
                  isNext
                    ? "border-accent-500 bg-accent-50 font-bold text-brand-900"
                    : "border-slate-200 bg-slate-50 text-slate-600",
                )}
              >
                <span
                  aria-hidden
                  className={cx(
                    "size-2 rounded-full",
                    gameDay ? "bg-slate-400" : g === "f" ? "bg-pink-400" : g === "m" ? "bg-sky-400" : "bg-slate-400",
                  )}
                />
                {e.name}
                <span className="text-xs text-slate-500">{Math.round(e.sharePct)}%</span>
                <span className="rounded-full bg-white px-1.5 text-xs font-semibold text-slate-500">
                  {e.leadsToday}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
