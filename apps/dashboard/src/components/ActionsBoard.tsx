"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { cx } from "@nlr/ui";

import type { ActionRowDTO, ActionsResponseDTO } from "../lib/movepro-actions";
import { useLiveRefresh } from "../lib/live";
import { SYDNEY_TZ } from "../lib/sydney";

const POLL_MS = 30000;
const STALE_MS = 90000;

/** Briefly true right after `value` changes, for a subtle number-change pulse
 * (no layout shift — just a colour flash on the digits themselves). */
function usePulseOnChange(value: number): boolean {
  const prev = useRef(value);
  const [pulsing, setPulsing] = useState(false);
  useEffect(() => {
    if (prev.current === value) return;
    prev.current = value;
    setPulsing(true);
    const t = window.setTimeout(() => setPulsing(false), 700);
    return () => window.clearTimeout(t);
  }, [value]);
  return pulsing;
}

function NumStat({ label, value }: { label: string; value: number }) {
  return (
    <span className="text-right leading-none">
      <span className="block text-sm font-bold text-white/70 tabular-nums">{value}</span>
      <span className="block text-[0.55rem] font-semibold tracking-wide text-white/35 uppercase">{label}</span>
    </span>
  );
}

function Row({ r, i }: { r: ActionRowDTO; i: number }) {
  const top3 = i < 3;
  const pulse = usePulseOnChange(r.total);
  return (
    <li
      className={cx(
        "mb-2 flex min-w-0 items-center gap-3 rounded-xl px-3 py-2 break-inside-avoid",
        top3 ? "border border-accent-400/40 bg-accent-400/[0.06]" : "border border-white/5 bg-white/[0.04]",
      )}
    >
      <span
        className={cx(
          "w-6 shrink-0 text-center text-sm font-bold",
          i === 0 ? "text-accent-400" : top3 ? "text-brand-200" : "text-white/40",
        )}
      >
        {i + 1}
      </span>
      <span className={cx("min-w-0 flex-1 truncate font-semibold text-white", top3 ? "text-xl" : "text-lg")}>
        {r.name}
      </span>
      <div className="flex shrink-0 items-end gap-3">
        <NumStat label="calls" value={r.calls} />
        <NumStat label="emails" value={r.emails} />
        <NumStat label="msgs" value={r.messages} />
        <span
          className={cx(
            "w-12 shrink-0 text-right leading-none font-black tabular-nums transition-colors duration-500",
            top3 ? "text-4xl" : "text-3xl",
            pulse ? "text-accent-300" : "text-white",
          )}
        >
          {r.total}
        </span>
      </div>
    </li>
  );
}

function Section({ title, rows }: { title: string; rows: ActionRowDTO[] }) {
  const total = rows.reduce((s, r) => s + r.total, 0);
  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-baseline justify-between">
        <h2 className="text-lg font-bold text-white">{title}</h2>
        <span className="text-sm font-medium text-white/50">{total} total</span>
      </div>
      {rows.length === 0 ? (
        <div className="mt-2 grid flex-1 place-items-center rounded-2xl border border-dashed border-white/15">
          <p className="text-sm font-medium text-white/40">No activity yet.</p>
        </div>
      ) : (
        <ul className="mt-2 min-h-0 flex-1 overflow-hidden [column-fill:balance] sm:columns-2 sm:gap-4">
          {rows.map((r, i) => (
            <Row key={r.name} r={r} i={i} />
          ))}
        </ul>
      )}
    </section>
  );
}

export function ActionsBoard({ initial }: { initial: ActionsResponseDTO }) {
  const [data, setData] = useState<ActionsResponseDTO>(initial);
  const [stale, setStale] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const lastSuccess = useRef(Date.now());
  const inFlight = useRef(false);

  const refetch = useCallback(() => {
    if (inFlight.current) return;
    inFlight.current = true;
    fetch("/api/actions", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: ActionsResponseDTO) => {
        setData(d);
        lastSuccess.current = Date.now();
        setStale(false);
      })
      .catch(() => setStale(Date.now() - lastSuccess.current > STALE_MS))
      .finally(() => {
        inFlight.current = false;
      });
  }, []);
  useLiveRefresh([], refetch, POLL_MS);

  useEffect(() => {
    const tick = setInterval(() => {
      setNow(Date.now());
      setStale(Date.now() - lastSuccess.current > STALE_MS);
    }, 1000);
    return () => clearInterval(tick);
  }, []);

  const secsAgo = Math.max(0, Math.round((now - lastSuccess.current) / 1000));
  const dateLabel = new Intl.DateTimeFormat("en-AU", {
    timeZone: SYDNEY_TZ,
    weekday: "short",
    day: "2-digit",
    month: "short",
  }).format(now);

  const loading = data.daily.length === 0 && data.monthly.length === 0;

  return (
    <main className="relative flex h-dvh flex-col gap-3 overflow-hidden bg-brand-900 p-4 text-white sm:p-5">
      {loading && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-brand-900/95">
          <p className="animate-pulse text-xl font-semibold text-white/60">Loading activity…</p>
        </div>
      )}

      <header className="flex shrink-0 items-baseline justify-between">
        <h1 className="text-2xl font-bold text-white">Rep activity</h1>
        <p className="flex items-baseline gap-3 text-sm font-medium text-white/50">
          <span>{dateLabel}</span>
          <span className={cx(stale && "text-red-400")}>
            {stale ? "connection lost" : `updated ${secsAgo}s ago`}
          </span>
        </p>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-2 gap-5">
        <Section title="Today" rows={data.daily} />
        <Section title="This month" rows={data.monthly} />
      </div>
    </main>
  );
}
