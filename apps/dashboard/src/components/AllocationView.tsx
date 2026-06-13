"use client";

import { useCallback, useState, useTransition } from "react";

import { cx } from "@nlr/ui";

import { assignNextLead } from "../app/actions/leads";
import { setIntakeWeight } from "../app/actions/manage";
import { useLiveRefresh } from "../lib/live";

interface RepRow {
  staffId: string;
  name: string;
  gender: "f" | "m" | "x";
  weight: number;
  status: "off" | "on" | "break" | "done";
  sharePct: number | null; // null when not eligible
  leadsToday: number;
}

interface AllocationDTO {
  reps: RepRow[];
  nextUp: string | null;
  totalLeadsToday: number;
  eligibleCount: number;
}

const STATUS_LABEL: Record<RepRow["status"], string> = {
  off: "Off",
  on: "Working",
  break: "On break",
  done: "Done",
};

function dot(g: "f" | "m" | "x") {
  return g === "f" ? "bg-pink-400" : g === "m" ? "bg-sky-400" : "bg-slate-300";
}

export function AllocationView({
  initial,
  isManager,
}: {
  initial: AllocationDTO;
  isManager: boolean;
}) {
  const [data, setData] = useState<AllocationDTO>(initial);
  const [toast, setToast] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const refetch = useCallback(() => {
    fetch("/api/allocation", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: AllocationDTO | null) => d && setData(d))
      .catch(() => undefined);
  }, []);
  useLiveRefresh(["clock", "bookings"], refetch);

  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 3500);
  };

  const assign = () =>
    startTransition(async () => {
      const r = await assignNextLead();
      flash(r.assignedTo ? `Lead → ${r.assignedTo} 🎯` : (r.error ?? "Couldn't assign"));
      refetch();
    });

  const nudge = (rep: RepRow, delta: number) =>
    startTransition(async () => {
      const next = Math.round(Math.min(3, Math.max(0, rep.weight + delta)) * 10) / 10;
      await setIntakeWeight(rep.staffId, next);
      refetch();
    });

  const next = data.reps.find((r) => r.staffId === data.nextUp);

  return (
    <div className="max-w-4xl">
      <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">Lead allocation</p>
      <h1 className="mt-1 text-4xl font-bold tracking-tight text-brand-900">Who&apos;s up next</h1>

      <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium text-slate-600">
            {data.eligibleCount === 0
              ? "Nobody clocked in & off-break right now"
              : next
                ? `Next lead is ${next.name}'s 🎯`
                : "Ready"}
            {" · "}
            {data.totalLeadsToday} leads today · {data.eligibleCount} eligible
          </p>
          <button
            type="button"
            onClick={assign}
            disabled={pending || data.eligibleCount === 0}
            className="min-h-10 rounded-full bg-brand-900 px-5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-brand-800 disabled:opacity-50 motion-safe:hover:-translate-y-0.5"
          >
            Assign next lead
          </button>
        </div>
      </section>

      <p className="mt-6 text-sm font-medium text-slate-500">
        Share is set by each rep&apos;s weight × hours worked today — only counts while clocked in
        and off break.{" "}
        {isManager ? "Turn the dial to tune anyone's slice." : "Managers can tune the dials."}
      </p>

      <ul className="mt-3 space-y-2">
        {data.reps.map((rep) => {
          const eligible = rep.status === "on";
          return (
            <li
              key={rep.staffId}
              className={cx(
                "flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border p-3 shadow-sm transition-colors sm:flex-nowrap",
                rep.staffId === data.nextUp
                  ? "border-accent-500 bg-accent-50"
                  : eligible
                    ? "border-slate-200 bg-white"
                    : "border-slate-200 bg-slate-50",
              )}
            >
              <span aria-hidden className={cx("size-2.5 shrink-0 rounded-full", dot(rep.gender))} />
              <span className="w-28 shrink-0 truncate font-bold text-brand-900">{rep.name}</span>

              {/* live share % */}
              <div className="flex w-32 shrink-0 items-center gap-2">
                {eligible ? (
                  <>
                    <span className="text-2xl font-bold tabular-nums text-brand-900">
                      {Math.round(rep.sharePct ?? 0)}%
                    </span>
                    {rep.staffId === data.nextUp && (
                      <span className="rounded-full bg-accent-400 px-2 py-0.5 text-[0.6rem] font-bold tracking-wide text-brand-950 uppercase">
                        Next
                      </span>
                    )}
                  </>
                ) : (
                  <span className="rounded-full bg-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600">
                    {STATUS_LABEL[rep.status]}
                  </span>
                )}
              </div>

              {/* leads today */}
              <span className="w-20 shrink-0 text-sm text-slate-500">
                {rep.leadsToday} lead{rep.leadsToday === 1 ? "" : "s"}
              </span>

              {/* weight dial */}
              <div className="ml-auto flex shrink-0 items-center gap-1">
                {isManager && (
                  <button
                    type="button"
                    aria-label={`Lower ${rep.name}'s weight`}
                    onClick={() => nudge(rep, -0.1)}
                    disabled={pending || rep.weight <= 0}
                    className="grid size-9 place-items-center rounded-full border border-slate-200 bg-white text-lg font-bold text-slate-600 hover:border-brand-300 disabled:opacity-40"
                  >
                    −
                  </button>
                )}
                <span className="w-16 text-center text-xs font-semibold text-slate-500">
                  weight {rep.weight.toFixed(1)}
                </span>
                {isManager && (
                  <button
                    type="button"
                    aria-label={`Raise ${rep.name}'s weight`}
                    onClick={() => nudge(rep, 0.1)}
                    disabled={pending || rep.weight >= 3}
                    className="grid size-9 place-items-center rounded-full border border-slate-200 bg-white text-lg font-bold text-slate-600 hover:border-brand-300 disabled:opacity-40"
                  >
                    +
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {toast && (
        <div className="fade-in fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full bg-brand-900 px-5 py-2.5 text-sm font-semibold text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
