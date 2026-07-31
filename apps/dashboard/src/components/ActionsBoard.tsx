"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { cx } from "@nlr/ui";

import { crossedGongThreshold, loadGongSeen, saveGongSeen, type GongEvent } from "../lib/actions-gong";
import { armAudio, audioRunning, playGong, startAudioKeepAlive } from "../lib/celebrate";
import { useLiveRefresh } from "../lib/live";
import type { ActionRowDTO, ActionsResponseDTO } from "../lib/movepro-actions";
import type { UnseenRowDTO, UnseenResponseDTO } from "../lib/movepro-unseen";
import { SYDNEY_TZ, sydneyToday } from "../lib/sydney";

const POLL_MS = 30000;
// /api/debug-movepro (since removed) showed there's no network block — the
// dashcard call legitimately takes 5s+ (Metabase actually executing the
// report query), and a cold-start monthly assembly (~30 parallel per-day
// calls, each up to the 20s FETCH_TIMEOUT_MS in movepro-actions.ts) can
// genuinely take a while. 45s is comfortably above that realistic range but
// still below the route's own 60s maxDuration, so this only flips to an
// error after the server itself would have already given up.
const STALE_MS = 45000;

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

/** Shared empty-panel placeholder — loading (first paint / cold fetch) or,
 * once that feed has been stale for a while, an honest failure message
 * instead of an indefinite spinner. Scoped per panel (not a page-wide
 * overlay) so one feed being down doesn't block the other two panels, which
 * may be perfectly fine. */
function EmptyPanel({ stale, label }: { stale: boolean; label: string }) {
  return (
    <div className="mt-2 grid flex-1 place-items-center rounded-2xl border border-dashed border-white/15 px-3 text-center">
      {stale ? (
        <div>
          <p className="text-sm font-semibold text-red-300">Can't reach the {label} feed</p>
          <p className="mt-1 text-xs text-white/40">Retrying every 30s.</p>
        </div>
      ) : (
        <p className="animate-pulse text-sm font-medium text-white/40">Loading…</p>
      )}
    </div>
  );
}

// ── Panel: rep activity (Today / This month) ────────────────────────────

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
        {/* Monthly totals reach 6 digits — a fixed ch-based width reserves
            room for that ("123,456" is 7 chars incl. the comma) so
            calls/emails/msgs never collide with it, without hardcoding a
            pixel value tied to one font size. */}
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

function Section({ title, rows, stale }: { title: string; rows: ActionRowDTO[]; stale: boolean }) {
  const total = rows.reduce((s, r) => s + r.total, 0);
  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-baseline justify-between">
        <h2 className="text-lg font-bold text-white">{title}</h2>
        <span className="text-sm font-medium text-white/50">{total.toLocaleString()} total</span>
      </div>
      {rows.length === 0 ? (
        <EmptyPanel stale={stale} label="activity" />
      ) : (
        // [grid-auto-rows:1fr] divides the panel's full height evenly across
        // however many rows exist, so the list spans the viewport with no
        // dead space and no scroll, regardless of rep count.
        <ul className="mt-2 grid min-h-0 flex-1 grid-cols-1 gap-1 overflow-hidden [grid-auto-rows:1fr]">
          {rows.map((r, i) => (
            <Row key={r.name} r={r} i={i} />
          ))}
        </ul>
      )}
    </section>
  );
}

// ── Panel: unseen communications ────────────────────────────────────────

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

function UnseenSection({ rows, stale }: { rows: UnseenRowDTO[]; stale: boolean }) {
  const total = rows.reduce((s, r) => s + r.totalUnseen, 0);
  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-baseline justify-between">
        <h2 className="text-lg font-bold text-white">Unseen communications</h2>
        <span className="text-sm font-medium text-white/50">{total.toLocaleString()} unseen</span>
      </div>
      {rows.length === 0 ? (
        <EmptyPanel stale={stale} label="unseen communications" />
      ) : (
        <ul className="mt-2 grid min-h-0 flex-1 grid-cols-1 gap-1 overflow-hidden [grid-auto-rows:1fr]">
          {rows.map((r, i) => (
            <UnseenRow key={r.name} r={r} i={i} />
          ))}
        </ul>
      )}
    </section>
  );
}

// ── Celebration gong ─────────────────────────────────────────────────────

// Cycle timing between successive queued gongs: HOLD + FADE is the banner's
// own visible lifetime, GAP is the pause after — the three sum to the ~2s
// spacing between gongs the spec asks for, with room to spare so they never
// overlap. FADE_MS matches globals.css's nl-overlay-out (0.5s), reused for
// the banner's exit rather than inventing a new timing.
const GONG_HOLD_MS = 1300;
const GONG_FADE_MS = 500;
const GONG_GAP_MS = 200;

const METRIC_LABEL: Record<GongEvent["metric"], string> = {
  calls: "calls",
  emails: "emails",
  messages: "messages",
};

/** Watches Today's per-rep calls/emails/messages and queues a gong + banner
 * event each time one crosses 100, ~2s apart so they never overlap. Seeded
 * silently per Sydney day (a fresh page load, or a rep already over 100
 * before anyone was watching, never gongs — only an observed crossing
 * does), and persisted to localStorage keyed by day so a refresh or
 * redeploy doesn't replay a gong that already fired, resetting naturally at
 * midnight since a new day's storage key starts empty. */
function useGongCelebration(rows: { name: string; calls: number; emails: number; messages: number }[]) {
  const seenRef = useRef<Set<string>>(new Set());
  const dayRef = useRef<string | null>(null);
  const seededRef = useRef(false);
  const queueRef = useRef<GongEvent[]>([]);
  const runningRef = useRef(false);
  const timersRef = useRef<number[]>([]);
  const [active, setActive] = useState<{ event: GongEvent; out: boolean } | null>(null);

  const drain = useCallback(() => {
    if (runningRef.current) return;
    const next = queueRef.current.shift();
    if (!next) return;
    runningRef.current = true;
    setActive({ event: next, out: false });
    playGong();
    timersRef.current.push(
      window.setTimeout(() => setActive((a) => (a ? { ...a, out: true } : a)), GONG_HOLD_MS),
    );
    timersRef.current.push(
      window.setTimeout(
        () => {
          setActive(null);
          runningRef.current = false;
          timersRef.current.push(window.setTimeout(drain, GONG_GAP_MS));
        },
        GONG_HOLD_MS + GONG_FADE_MS,
      ),
    );
  }, []);

  useEffect(() => {
    const today = sydneyToday();
    if (dayRef.current !== today) {
      dayRef.current = today;
      seenRef.current = loadGongSeen(today);
      seededRef.current = false;
    }
    const seed = !seededRef.current;
    seededRef.current = true;
    const events = crossedGongThreshold(rows, seenRef.current, seed);
    if (events.length === 0) return;
    saveGongSeen(today, seenRef.current);
    queueRef.current.push(...events);
    drain();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  useEffect(() => () => timersRef.current.forEach((t) => window.clearTimeout(t)), []);

  return active;
}

function GongBanner({ active }: { active: { event: GongEvent; out: boolean } | null }) {
  if (!active) return null;
  const { event, out } = active;
  return (
    <div
      role="status"
      aria-live="polite"
      className={cx(
        "pointer-events-none fixed top-4 left-1/2 z-50 -translate-x-1/2 rounded-full border border-accent-400/60 bg-black/85 px-6 py-2.5 shadow-[0_0_30px_-6px_rgba(255,212,46,0.6)] backdrop-blur",
        out ? "nl-overlay-out" : "nl-rise",
      )}
    >
      <span className="text-base font-bold text-accent-200 sm:text-lg">
        🔔 {event.name} hit 100 {METRIC_LABEL[event.metric]}!
      </span>
    </div>
  );
}

// ── Shared polling ───────────────────────────────────────────────────────

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

/**
 * Static three-panel wall board — Unseen communications | Today | This
 * month, side by side, always all visible (no rotation). Both underlying
 * feeds poll independently on the same 30s cycle; the header's "updated Xs
 * ago" reflects whichever of the two is currently the more stale, so it
 * never claims to be fresher than the slower-updating panel actually is.
 */
export function ActionsBoard({
  initialActivity,
  initialUnseen,
}: {
  initialActivity: ActionsResponseDTO;
  initialUnseen: UnseenResponseDTO;
}) {
  const activity = usePolledData<ActionsResponseDTO>("/api/actions", initialActivity);
  const unseen = usePolledData<UnseenResponseDTO>("/api/unseen", initialUnseen);
  const gong = useGongCelebration(activity.data.daily);

  // Browsers block audio until the page is interacted with. On a wall TV
  // nobody clicks, so keep arming on ANY interaction (not just once) and
  // surface a "tap to enable sound" prompt until the context is actually
  // running — else the gong silently never plays. Same pattern as /live's
  // LiveBoard.
  const [soundLocked, setSoundLocked] = useState(true);
  useEffect(() => {
    const sync = () => setSoundLocked(!audioRunning());
    const arm = () => {
      armAudio();
      window.setTimeout(sync, 80); // resume() is async — re-check just after
    };
    sync();
    window.addEventListener("pointerdown", arm);
    window.addEventListener("keydown", arm);
    document.addEventListener("visibilitychange", sync);
    const stopKeepAlive = startAudioKeepAlive();
    return () => {
      window.removeEventListener("pointerdown", arm);
      window.removeEventListener("keydown", arm);
      document.removeEventListener("visibilitychange", sync);
      stopKeepAlive();
    };
  }, []);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  const oldestSuccess = Math.min(activity.lastSuccess.current, unseen.lastSuccess.current);
  const secsAgo = Math.max(0, Math.round((now - oldestSuccess) / 1000));
  const anyStale = activity.stale || unseen.stale;
  const dateLabel = new Intl.DateTimeFormat("en-AU", {
    timeZone: SYDNEY_TZ,
    weekday: "short",
    day: "2-digit",
    month: "short",
  }).format(now);

  return (
    <main className="flex h-dvh flex-col gap-3 overflow-hidden bg-brand-900 p-4 text-white sm:p-5">
      <GongBanner active={gong} />

      {soundLocked && (
        <button
          type="button"
          onClick={() => armAudio()}
          className="fixed right-4 bottom-4 z-50 flex animate-pulse items-center gap-2 rounded-full border border-accent-400/50 bg-black/85 px-4 py-2 text-sm font-semibold text-accent-200 shadow-lg backdrop-blur"
        >
          <span aria-hidden>🔇</span> Tap anywhere to enable sound
        </button>
      )}

      <header className="flex shrink-0 items-baseline justify-between">
        <h1 className="text-2xl font-bold text-white">Rep activity</h1>
        <p className="flex items-baseline gap-3 text-sm font-medium text-white/50">
          <span>{dateLabel}</span>
          <span className={cx(anyStale && "text-red-400")}>
            {anyStale ? "connection lost" : `updated ${secsAgo}s ago`}
          </span>
        </p>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-3 gap-5">
        <UnseenSection rows={unseen.data.rows} stale={unseen.stale} />
        <Section title="Today" rows={activity.data.daily} stale={activity.stale} />
        <Section title="This month" rows={activity.data.monthly} stale={activity.stale} />
      </div>
    </main>
  );
}
