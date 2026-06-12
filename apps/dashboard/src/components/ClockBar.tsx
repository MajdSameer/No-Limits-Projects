"use client";

import { useEffect, useState, useTransition } from "react";

import { cx } from "@nlr/ui";

import { punch } from "../app/actions/clock";
import type { ClockKind, ClockStatus } from "../lib/clock";

export interface ClockBarProps {
  status: ClockStatus;
  /** ISO of when the current status began (null when off). */
  sinceISO: string | null;
  /** Worked ms accumulated up to render time. */
  workedMs: number;
  actions: ClockKind[];
}

const ACTION_LABEL: Record<ClockKind, string> = {
  in: "Clock in",
  break_start: "Start break",
  break_end: "End break",
  out: "Clock out",
};

const STATUS_LABEL: Record<ClockStatus, string> = {
  off: "Not clocked in",
  on: "On the clock",
  break: "On break",
  done: "Done for today",
};

function fmt(ms: number): string {
  const mins = Math.floor(ms / 60000);
  return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, "0")}m`;
}

export function ClockBar({ status, sinceISO, workedMs, actions }: ClockBarProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Re-render every 30s so the live counter ticks.
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  const liveWorkedMs =
    status === "on" && sinceISO
      ? workedMs + Math.max(0, Date.now() - new Date(sinceISO).getTime())
      : workedMs;

  const doPunch = (kind: ClockKind) => {
    setError(null);
    startTransition(async () => {
      const result = await punch(kind);
      if (result.error) setError(result.error);
    });
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-accent-400 bg-ink-900/95 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4">
        <p className="min-w-0 truncate font-mono text-xs tracking-widest uppercase">
          <span
            aria-hidden
            className={cx(
              "mr-2 inline-block size-2 rounded-full align-middle",
              status === "on" && "bg-accent-400",
              status === "break" && "bg-brand-300",
              status === "off" && "bg-brand-700",
              status === "done" && "bg-brand-500",
            )}
          />
          <span className="text-manila-200">{STATUS_LABEL[status]}</span>
          {status !== "off" && (
            <span className="ml-3 text-brand-300">
              worked {fmt(liveWorkedMs)}
              {status === "break" && " · on break"}
            </span>
          )}
          {error && (
            <span role="alert" className="ml-3 text-accent-300">
              {error}
            </span>
          )}
        </p>

        <div className="flex shrink-0 items-center gap-2">
          {actions.map((kind, i) => (
            <button
              key={kind}
              type="button"
              disabled={pending}
              onClick={() => doPunch(kind)}
              className={cx(
                "min-h-11 rounded-full px-5 font-mono text-xs font-bold tracking-widest uppercase transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-400 motion-safe:hover:-translate-y-0.5",
                i === 0
                  ? "bg-accent-400 text-ink-950 hover:bg-accent-300"
                  : "border border-brand-700 text-manila-200 hover:border-accent-400",
                pending && "opacity-60",
              )}
            >
              {pending ? "…" : ACTION_LABEL[kind]}
            </button>
          ))}
          {actions.length === 0 && (
            <span className="font-mono text-xs tracking-widest text-brand-300 uppercase">
              See you tomorrow 👋
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
