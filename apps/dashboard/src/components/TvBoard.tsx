"use client";

import confetti from "canvas-confetti";
import { useCallback, useEffect, useRef, useState } from "react";

import { cx } from "@nlr/ui";

import type { BoardsDTO } from "./Board";
import { BookingCelebration } from "./BookingCelebration";
import { armAudio } from "../lib/celebrate";
import { useLiveRefresh } from "../lib/live";
import { SYDNEY_TZ, sydneyToday } from "../lib/sydney";

type Tab = "daily" | "monthly" | "pipeline";
const ORDER: Tab[] = ["daily", "monthly", "pipeline"];
const TAB_TITLE: Record<Tab, string> = {
  daily: "Today",
  monthly: "This month",
  pipeline: "Next 3 months",
};
const CYCLE_MS = 20000;
const STALE_MS = 30000;

export function TvBoard({ initial }: { initial: BoardsDTO }) {
  const [data, setData] = useState<BoardsDTO>(initial);
  const [tab, setTab] = useState<Tab>("daily");
  const [stale, setStale] = useState(false);
  const [clock, setClock] = useState("");
  const lastSuccess = useRef(Date.now());
  const inFlight = useRef(false);

  // Enable the gong after any interaction (TV may need one click to unmute).
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
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: BoardsDTO) => {
        setData(d);
        lastSuccess.current = Date.now();
        setStale(false);
      })
      .catch(() => setStale(Date.now() - lastSuccess.current > STALE_MS))
      .finally(() => {
        inFlight.current = false;
      });
  }, []);
  useLiveRefresh(["bookings"], refetch);

  // Cycle boards + tick the wall clock + stale watchdog.
  useEffect(() => {
    const cycle = setInterval(
      () => setTab((t) => ORDER[(ORDER.indexOf(t) + 1) % ORDER.length] as Tab),
      CYCLE_MS,
    );
    const tick = setInterval(() => {
      setClock(
        new Intl.DateTimeFormat("en-AU", {
          timeZone: SYDNEY_TZ,
          hour: "2-digit",
          minute: "2-digit",
          weekday: "short",
          day: "2-digit",
          month: "short",
        }).format(new Date()),
      );
      setStale(Date.now() - lastSuccess.current > STALE_MS);
    }, 1000);
    return () => {
      clearInterval(cycle);
      clearInterval(tick);
    };
  }, []);

  // Goal celebrations: once per rep per Sydney day on this screen.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const key = `nl-tv-goalhits-${sydneyToday()}`;
    const seen = new Set<string>(JSON.parse(localStorage.getItem(key) ?? "[]") as string[]);
    let newHit: string | null = null;
    for (const r of data.daily) {
      if (r.goal && r.count >= r.goal && !seen.has(r.staffId)) {
        seen.add(r.staffId);
        newHit = r.name;
      }
    }
    if (newHit) {
      localStorage.setItem(key, JSON.stringify([...seen]));
      confetti({ particleCount: 250, spread: 120, origin: { y: 0.5 }, colors: ["#ffd42e", "#fff389", "#f4f1e8"] });
    }
  }, [data]);

  const rows = tab === "daily" ? data.daily : tab === "monthly" ? data.monthly : data.pipeline;
  const top = rows.slice(0, 8);

  return (
    <main className="ink-grain flex h-dvh flex-col overflow-hidden bg-ink-950 text-manila-100">
      <BookingCelebration daily={data.daily} />
      <header className="flex items-center justify-between border-b-2 border-accent-400 px-8 py-4">
        <p className="font-display text-2xl font-bold tracking-wide uppercase">
          No Limits <span className="text-accent-400">Ops</span>
        </p>
        <p className="font-mono text-lg tracking-[0.2em] text-manila-200 uppercase">{clock}</p>
      </header>

      {stale && (
        <p role="alert" className="bg-accent-400 px-8 py-2 text-center font-mono text-sm font-bold tracking-[0.2em] text-ink-950 uppercase">
          Reconnecting — numbers may be behind
        </p>
      )}

      <div className="flex flex-1 flex-col px-8 py-6">
        <div className="flex items-baseline justify-between">
          <h1 className="font-display text-[clamp(2.5rem,6vw,5rem)] leading-none font-bold tracking-wide text-accent-400 uppercase">
            {TAB_TITLE[tab]}
          </h1>
          <div className="flex gap-2" aria-hidden>
            {ORDER.map((t) => (
              <span key={t} className={cx("h-2 w-8", t === tab ? "bg-accent-400" : "bg-brand-800")} />
            ))}
          </div>
        </div>

        <ol className="mt-6 grid flex-1 grid-cols-2 content-start gap-x-12 gap-y-4">
          {top.map((r, i) => {
            const done = tab === "daily" && r.goal !== null && r.count >= r.goal;
            return (
              <li
                key={r.staffId}
                className={cx(
                  "flex items-center gap-6 border-b-2 px-2 py-2",
                  done ? "border-accent-400 bg-accent-400/10" : "border-brand-800",
                )}
              >
                <span className="font-display w-14 text-4xl font-bold text-brand-300">{i + 1}</span>
                <span className="flex-1 truncate font-display text-[clamp(1.8rem,3.2vw,3rem)] font-bold tracking-wide uppercase">
                  {r.name}
                </span>
                {done && <span className="text-3xl" role="img" aria-label="goal hit">🎉</span>}
                <span className={cx("font-display text-[clamp(2.2rem,4vw,3.8rem)] font-bold tracking-wide", done ? "text-accent-400" : "text-manila-100")}>
                  {r.count}
                  {tab === "daily" && r.goal !== null && (
                    <span className="ml-2 text-2xl text-brand-300">/ {r.goal}</span>
                  )}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </main>
  );
}
