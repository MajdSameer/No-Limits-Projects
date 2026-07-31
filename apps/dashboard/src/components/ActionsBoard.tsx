"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { cx } from "@nlr/ui";

import type { ActionRowDTO, ActionsResponseDTO } from "../lib/movepro-actions";
import type { UnseenRowDTO, UnseenResponseDTO } from "../lib/movepro-unseen";
import { useLiveRefresh } from "../lib/live";
import { SYDNEY_TZ } from "../lib/sydney";

const POLL_MS = 30000;
// /api/debug-movepro showed there's no network block — the dashcard call
// legitimately takes 5s+ (Metabase actually executing the report query), and
// a cold-start monthly assembly (~30 parallel per-day calls, each up to the
// 20s FETCH_TIMEOUT_MS in movepro-actions.ts) can genuinely take a while.
// 45s is comfortably above that realistic range but still below the route's
// own 60s maxDuration, so this only flips to an error after the server
// itself would have already given up.
const STALE_MS = 45000;
const ROTATION_MS = 30000;

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

/** Fixed ch-based width (scales with the element's own font-size, so it
 * stays correct across the vmin-clamped sizes below) — reserves enough room
 * for a 5-digit stat so it never collides with its neighbour, without
 * needing a hardcoded pixel value tied to one particular row height. */
function NumStat({ label, value }: { label: string; value: number }) {
  return (
    <span className="w-[5ch] shrink-0 text-right leading-none">
      <span className="block text-[clamp(0.5rem,1.5vmin,0.95rem)] font-bold text-white/70 tabular-nums">
        {value.toLocaleString()}
      </span>
      <span className="block text-[clamp(0.35rem,0.8vmin,0.55rem)] font-semibold tracking-wide text-white/35 uppercase">
        {label}
      </span>
    </span>
  );
}

// ── View 1: rep activity ────────────────────────────────────────────────

function Row({ r, i }: { r: ActionRowDTO; i: number }) {
  const top3 = i < 3;
  const pulse = usePulseOnChange(r.total);
  return (
    <li
      className={cx(
        "flex min-w-0 items-center gap-2 overflow-hidden rounded-lg px-3 py-1",
        top3 ? "border border-accent-400/40 bg-accent-400/[0.06]" : "border border-white/5 bg-white/[0.04]",
      )}
    >
      <span
        className={cx(
          "w-[2ch] shrink-0 text-center font-bold text-[clamp(0.5rem,1.4vmin,0.9rem)]",
          i === 0 ? "text-accent-400" : top3 ? "text-brand-200" : "text-white/40",
        )}
      >
        {i + 1}
      </span>
      <span
        className={cx(
          "min-w-0 flex-1 truncate font-semibold text-white",
          top3 ? "text-[clamp(0.65rem,2vmin,1.2rem)]" : "text-[clamp(0.6rem,1.7vmin,1rem)]",
        )}
      >
        {r.name}
      </span>
      <div className="flex shrink-0 items-end gap-1.5">
        <NumStat label="calls" value={r.calls} />
        <NumStat label="emails" value={r.emails} />
        <NumStat label="msgs" value={r.messages} />
        {/* Monthly totals reach 5 digits (e.g. 12,669) — a fixed ch-based
            width reserves room for that so calls/emails/msgs never collide
            with it, without hardcoding a pixel value tied to one font size. */}
        <span
          className={cx(
            "w-[7ch] shrink-0 text-right leading-none font-black tabular-nums transition-colors duration-500",
            top3 ? "text-[clamp(0.8rem,2.4vmin,1.6rem)]" : "text-[clamp(0.7rem,2vmin,1.3rem)]",
            pulse ? "text-accent-300" : "text-white",
          )}
        >
          {r.total.toLocaleString()}
        </span>
      </div>
    </li>
  );
}

function Section({ title, rows }: { title: string; rows: ActionRowDTO[] }) {
  const total = rows.reduce((s, r) => s + r.total, 0);
  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-baseline justify-between">
        <h2 className="text-lg font-bold text-white">{title}</h2>
        <span className="text-sm font-medium text-white/50">{total.toLocaleString()} total</span>
      </div>
      {rows.length === 0 ? (
        <div className="mt-2 grid flex-1 place-items-center rounded-2xl border border-dashed border-white/15">
          <p className="text-sm font-medium text-white/40">No activity yet.</p>
        </div>
      ) : (
        // [grid-auto-rows:1fr] divides the section's full height evenly
        // across however many rows exist, so the list spans the viewport
        // with no dead space and no scroll, regardless of rep count.
        <ul className="mt-2 grid min-h-0 flex-1 grid-cols-1 gap-1 overflow-hidden [grid-auto-rows:1fr]">
          {rows.map((r, i) => (
            <Row key={r.name} r={r} i={i} />
          ))}
        </ul>
      )}
    </section>
  );
}

function ActivityView({ data }: { data: ActionsResponseDTO }) {
  return (
    <div className="grid h-full min-h-0 grid-cols-2 gap-5">
      <Section title="Today" rows={data.daily} />
      <Section title="This month" rows={data.monthly} />
    </div>
  );
}

// ── View 2: unseen communications ───────────────────────────────────────

/** Accountability metric — high is bad. Top 3 (the worst backlog) get an
 * amber/red highlight instead of activity's gold; a rep with nothing unseen
 * is dimmed green instead of the default neutral row. */
function UnseenRow({ r, i }: { r: UnseenRowDTO; i: number }) {
  const top3 = i < 3;
  const isZero = r.totalUnseen === 0;
  const pulse = usePulseOnChange(r.totalUnseen);
  return (
    <li
      className={cx(
        "flex min-w-0 items-center gap-2 overflow-hidden rounded-lg px-3 py-1 border",
        top3
          ? "border-red-400/40 bg-red-400/[0.07]"
          : isZero
            ? "border-emerald-400/15 bg-emerald-400/[0.03]"
            : "border-white/5 bg-white/[0.04]",
      )}
    >
      <span
        className={cx(
          "w-[2ch] shrink-0 text-center font-bold text-[clamp(0.5rem,1.4vmin,0.9rem)]",
          i === 0 ? "text-red-400" : top3 ? "text-amber-300" : isZero ? "text-emerald-400/50" : "text-white/40",
        )}
      >
        {i + 1}
      </span>
      <span
        className={cx(
          "min-w-0 flex-1 truncate font-semibold",
          isZero ? "text-emerald-200/70" : "text-white",
          top3 ? "text-[clamp(0.65rem,2vmin,1.2rem)]" : "text-[clamp(0.6rem,1.7vmin,1rem)]",
        )}
      >
        {r.name}
      </span>
      <div className="flex shrink-0 items-end gap-1.5">
        <NumStat label="email/sms" value={r.emailSms} />
        <NumStat label="calls" value={r.callsCallbacks} />
        <span
          className={cx(
            "w-[7ch] shrink-0 text-right leading-none font-black tabular-nums transition-colors duration-500",
            top3 ? "text-[clamp(0.8rem,2.4vmin,1.6rem)]" : "text-[clamp(0.7rem,2vmin,1.3rem)]",
            isZero ? "text-emerald-300" : pulse ? "text-amber-300" : top3 ? "text-red-300" : "text-white",
          )}
        >
          {r.totalUnseen.toLocaleString()}
        </span>
      </div>
    </li>
  );
}

function UnseenView({ data }: { data: UnseenResponseDTO }) {
  const rows = data.rows;
  const twoCol = rows.length > 14;
  const rowsPerCol = twoCol ? Math.ceil(rows.length / 2) : rows.length;
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {rows.length === 0 ? (
        <div className="grid flex-1 place-items-center rounded-2xl border border-dashed border-white/15">
          <p className="text-sm font-medium text-white/40">No data yet.</p>
        </div>
      ) : (
        <ul
          className="grid min-h-0 flex-1 gap-1 overflow-hidden"
          style={{
            gridTemplateColumns: twoCol ? "repeat(2, 1fr)" : "1fr",
            gridTemplateRows: `repeat(${rowsPerCol}, 1fr)`,
            gridAutoFlow: twoCol ? "column" : "row",
            columnGap: twoCol ? "1.5rem" : undefined,
          }}
        >
          {rows.map((r, i) => (
            <UnseenRow key={r.name} r={r} i={i} />
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Shared polling + rotation orchestration ─────────────────────────────

function usePolledData<T>(url: string, initial: T) {
  const [data, setData] = useState<T>(initial);
  const [stale, setStale] = useState(false);
  const lastSuccess = useRef(Date.now());
  const inFlight = useRef(false);

  const refetch = useCallback(() => {
    if (inFlight.current) return;
    inFlight.current = true;
    fetch(url, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: T) => {
        setData(d);
        lastSuccess.current = Date.now();
        setStale(false);
      })
      .catch(() => setStale(Date.now() - lastSuccess.current > STALE_MS))
      .finally(() => {
        inFlight.current = false;
      });
  }, [url]);
  useLiveRefresh([], refetch, POLL_MS);

  useEffect(() => {
    const tick = setInterval(() => setStale(Date.now() - lastSuccess.current > STALE_MS), 1000);
    return () => clearInterval(tick);
  }, []);

  return { data, stale, lastSuccess };
}

type View = "activity" | "unseen";

function readPinnedView(): View | null {
  const v = new URLSearchParams(window.location.search).get("view");
  return v === "activity" || v === "unseen" ? v : null;
}

export function ActionsBoard({
  initialActivity,
  initialUnseen,
}: {
  initialActivity: ActionsResponseDTO;
  initialUnseen: UnseenResponseDTO;
}) {
  // Both datasets poll unconditionally, regardless of which view (or
  // whether a view is pinned) is showing — so a view is never stale when it
  // becomes visible, and so pinning doesn't need to special-case anything.
  const activity = usePolledData<ActionsResponseDTO>("/api/actions", initialActivity);
  const unseen = usePolledData<UnseenResponseDTO>("/api/unseen", initialUnseen);

  const [pinnedView, setPinnedView] = useState<View | null>(null);
  useEffect(() => setPinnedView(readPinnedView()), []);

  const [rotatedView, setRotatedView] = useState<View>("activity");
  // Self-rescheduling timeout (not setInterval) so it depends on rotatedView
  // itself: a manual click via selectView below changes rotatedView, which
  // re-runs this effect and starts a fresh 30s countdown from that moment —
  // otherwise the old interval would still be mid-countdown and could flip
  // the view again seconds after someone just picked one by hand.
  useEffect(() => {
    if (pinnedView) return;
    const t = setTimeout(() => setRotatedView((v) => (v === "activity" ? "unseen" : "activity")), ROTATION_MS);
    return () => clearTimeout(t);
  }, [pinnedView, rotatedView]);
  const activeView: View = pinnedView ?? rotatedView;
  const selectView = useCallback((v: View) => setRotatedView(v), []);

  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    setReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  const active = activeView === "activity" ? activity : unseen;
  const secsAgo = Math.max(0, Math.round((now - active.lastSuccess.current) / 1000));
  const dateLabel = new Intl.DateTimeFormat("en-AU", {
    timeZone: SYDNEY_TZ,
    weekday: "short",
    day: "2-digit",
    month: "short",
  }).format(now);

  const activityEmpty = activity.data.daily.length === 0 && activity.data.monthly.length === 0;
  const unseenEmpty = unseen.data.rows.length === 0;
  const activeEmpty = activeView === "activity" ? activityEmpty : unseenEmpty;

  const title = activeView === "activity" ? "Rep activity" : "Unseen communications";

  return (
    <main className="relative flex h-dvh flex-col gap-3 overflow-hidden bg-brand-900 p-4 text-white sm:p-5">
      {activeEmpty && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-brand-900/95">
          {active.stale ? (
            <div className="max-w-sm px-6 text-center">
              <p className="text-xl font-semibold text-red-300">Can't reach the {title.toLowerCase()} feed</p>
              <p className="mt-2 text-sm text-white/50">Retrying every 30s.</p>
            </div>
          ) : (
            <p className="animate-pulse text-xl font-semibold text-white/60">Loading…</p>
          )}
        </div>
      )}

      <header className="flex shrink-0 items-baseline justify-between">
        <h1 className="text-2xl font-bold text-white">{title}</h1>
        <p className="flex items-baseline gap-3 text-sm font-medium text-white/50">
          <span>{dateLabel}</span>
          <span className={cx(active.stale && "text-red-400")}>
            {active.stale ? "connection lost" : `updated ${secsAgo}s ago`}
          </span>
        </p>
      </header>

      {/* Both views render stacked in the same fixed-size box the whole
          time (never mounted/unmounted on rotation) and crossfade via
          opacity, so switching views never shifts layout. */}
      <div className="relative min-h-0 flex-1">
        <div
          className={cx(
            "absolute inset-0",
            !reducedMotion && "transition-opacity duration-500",
            activeView === "activity" ? "opacity-100" : "pointer-events-none opacity-0",
          )}
          aria-hidden={activeView !== "activity"}
        >
          <ActivityView data={activity.data} />
        </div>
        <div
          className={cx(
            "absolute inset-0",
            !reducedMotion && "transition-opacity duration-500",
            activeView === "unseen" ? "opacity-100" : "pointer-events-none opacity-0",
          )}
          aria-hidden={activeView !== "unseen"}
        >
          <UnseenView data={unseen.data} />
        </div>
      </div>

      {/* Doubles as the manual view switch — clicking a dot jumps straight to
          that view and resets the 30s rotation countdown from that moment
          (see the effect above), so it doesn't flip back a few seconds
          later. Hidden when a view is pinned via ?view=, since there's
          nothing to switch to in that mode. */}
      {!pinnedView && (
        <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1">
          <button
            type="button"
            onClick={() => selectView("activity")}
            aria-label="Show rep activity"
            aria-current={activeView === "activity"}
            className="p-3"
          >
            <span
              className={cx(
                "block size-2 rounded-full transition-colors",
                activeView === "activity" ? "bg-accent-400" : "bg-white/20",
              )}
            />
          </button>
          <button
            type="button"
            onClick={() => selectView("unseen")}
            aria-label="Show unseen communications"
            aria-current={activeView === "unseen"}
            className="p-3"
          >
            <span
              className={cx(
                "block size-2 rounded-full transition-colors",
                activeView === "unseen" ? "bg-accent-400" : "bg-white/20",
              )}
            />
          </button>
        </div>
      )}
    </main>
  );
}
