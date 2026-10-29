"use client";

import confetti from "canvas-confetti";
import { useCallback, useEffect, useRef, useState } from "react";

import { cx } from "@nlr/ui";

import type { Announcement } from "../lib/announce";
import { playAnnounceSound } from "../lib/announce-sound";
import { useLiveRefresh } from "../lib/live";

/**
 * The instant "Booked!" moment fired from the public /booked form:
 *
 *      X
 *      BOOKED  #MOVEPRO
 *      for
 *      Y
 *
 * Polls /api/announce every second (and reacts to the realtime ping when the
 * project has Supabase configured), so it lands within a second or two of the
 * Submit button. It is NOT the booking-count celebration — different palette,
 * different sound. Baselines silently on mount so loading/reloading the wall
 * never replays an old announcement; several in a row queue up and play one
 * after another.
 */
const HOLD_MS = 7000; // how long one announcement stays up
const FADE_MS = 500; // fade-out tail at the end of HOLD_MS
const GAP_MS = 200; // beat between queued announcements
const MAX_QUEUE = 6; // never black the wall out for minutes on a burst
const POLL_MS = 1000;

const BURST = ["#e879f9", "#f0abfc", "#22d3ee", "#a5f3fc", "#ffffff"];

function reducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function AnnouncementCelebration() {
  const [current, setCurrent] = useState<Announcement | null>(null);
  const [out, setOut] = useState(false);
  const cursor = useRef<string | null>(null); // null = not baselined yet
  const queue = useRef<Announcement[]>([]);
  const busy = useRef(false);
  const inFlight = useRef(false);
  const timers = useRef<number[]>([]);

  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);

  const showNext = useCallback(() => {
    if (busy.current) return;
    const next = queue.current.shift();
    if (!next) return;
    busy.current = true;
    setOut(false);
    setCurrent(next);
    playAnnounceSound();
    if (!reducedMotion()) {
      confetti({ particleCount: 140, angle: 60, spread: 70, startVelocity: 55, origin: { x: 0, y: 0.7 }, colors: BURST });
      confetti({ particleCount: 140, angle: 120, spread: 70, startVelocity: 55, origin: { x: 1, y: 0.7 }, colors: BURST });
      later(() => confetti({ particleCount: 160, spread: 140, startVelocity: 40, origin: { y: 0.45 }, colors: BURST }), 450);
    }
    later(() => setOut(true), HOLD_MS - FADE_MS);
    later(() => {
      setCurrent(null);
      busy.current = false;
      later(showNext, GAP_MS);
    }, HOLD_MS);
  }, [later]);

  const poll = useCallback(() => {
    if (inFlight.current) return;
    inFlight.current = true;
    const url = cursor.current === null ? "/api/announce" : `/api/announce?after=${encodeURIComponent(cursor.current)}`;
    fetch(url, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { items: Announcement[]; cursor: string | null } | null) => {
        if (!d) return;
        if (cursor.current === null) {
          // First response = the baseline: remember where we are, show nothing.
          cursor.current = d.cursor ?? "ann:";
          return;
        }
        if (d.cursor) cursor.current = d.cursor;
        if (d.items.length > 0) {
          queue.current.push(...d.items);
          if (queue.current.length > MAX_QUEUE) queue.current = queue.current.slice(-MAX_QUEUE);
          showNext();
        }
      })
      .catch(() => undefined)
      .finally(() => {
        inFlight.current = false;
      });
  }, [showNext]);

  useLiveRefresh(["announce"], poll, POLL_MS);

  useEffect(() => {
    const t = timers.current;
    return () => t.forEach((id) => window.clearTimeout(id));
  }, []);

  if (!current) return null;
  return (
    <div
      role="status"
      aria-live="assertive"
      className={cx(
        "fixed inset-0 z-[110] flex flex-col items-center justify-center gap-5 overflow-hidden bg-ink-950 px-6 text-center",
        out ? "nl-overlay-out" : "nl-overlay-in",
      )}
    >
      <div
        aria-hidden
        className="nl-glow pointer-events-none absolute inset-0 [background:radial-gradient(60%_60%_at_50%_45%,rgba(232,121,249,0.30),transparent_70%)]"
      />
      <p className="nl-pop-lg font-display relative max-w-full leading-none font-black text-white uppercase [font-size:clamp(3rem,12vw,9rem)] break-words">
        {current.by}
      </p>
      <div className="nl-rise relative flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
        <span className="font-mono font-bold tracking-[0.45em] text-fuchsia-300 uppercase [font-size:clamp(1rem,2.6vw,2rem)]">
          Booked
        </span>
        <span className="rounded-2xl border-2 border-fuchsia-400/80 bg-black/40 px-7 py-3 font-mono font-bold tracking-[0.25em] text-fuchsia-300 shadow-[0_0_40px_-6px_rgba(232,121,249,0.65)] [font-size:clamp(1.5rem,5vw,3.2rem)]">
          #{current.job}
        </span>
      </div>
      <p className="nl-rise relative font-display text-2xl font-bold text-white/70 [animation-delay:0.15s] sm:text-4xl">for</p>
      <p className="nl-pop-lg relative max-w-full font-display leading-none font-black text-fuchsia-300 uppercase [animation-delay:0.2s] [font-size:clamp(2.6rem,10vw,7.5rem)] break-words">
        {current.forRep}
      </p>
    </div>
  );
}
