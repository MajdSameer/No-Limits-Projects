"use client";

import { useEffect, useRef, useState } from "react";

import { cx } from "@nlr/ui";

import { cleanName, normalizeJob } from "../lib/announce";

/**
 * The public "Booked!" form — exactly three questions, one at a time:
 *   1. What is the MovePro job number?   → Next
 *   2. What is your name?                → Next
 *   3. Who are you booking this job for? → Submit
 * Q2 is a pick-list of reps (not free text) so the /live "booked for others" tally
 * is exact; Q3 hides whoever you picked in Q2. Submitting posts to /api/announce, which fires the instant celebration on the
 * /live wall. Mobile-first (phones are what people will use), big touch targets.
 */
type Step = 1 | 2 | 3 | "done";

const NAME_KEY = "booked:name";

export function BookedForm({ reps, submitters }: { reps: string[]; submitters: string[] }) {
  const [step, setStep] = useState<Step>(1);
  const [job, setJob] = useState("");
  const [by, setBy] = useState("");
  const [forRep, setForRep] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ job: string; forRep: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Remember who you are on this phone so question 2 is pre-filled next time.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(NAME_KEY);
      if (saved && submitters.includes(saved)) setBy(saved);
    } catch {
      /* private mode etc. — just start blank */
    }
  }, [submitters]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [step]);

  const jobOk = normalizeJob(job) !== null;
  const nameOk = cleanName(by) !== null;
  const repOk = cleanName(forRep) !== null;

  function next() {
    setError(null);
    if (step === 1 && jobOk) setStep(2);
    else if (step === 2 && nameOk) {
      if (forRep === by) setForRep("");
      setStep(3);
    }
  }

  async function submit() {
    if (!jobOk || !nameOk || !repOk || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/announce", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ job, by, forRep, company: honeypot }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !data?.ok) {
        setError(data?.error ?? "Could not send — please try again.");
        return;
      }
      try {
        window.localStorage.setItem(NAME_KEY, cleanName(by) ?? "");
      } catch {
        /* ignore */
      }
      setSent({ job: normalizeJob(job)!, forRep: cleanName(forRep)! });
      setStep("done");
    } catch {
      setError("No connection — check your signal and try again.");
    } finally {
      setSending(false);
    }
  }

  function again() {
    setJob("");
    setForRep("");
    setSent(null);
    setError(null);
    setStep(1);
  }

  const primary =
    "w-full rounded-2xl bg-fuchsia-400 px-6 py-5 text-xl font-black tracking-wide text-ink-950 uppercase transition active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/30";
  const field =
    "w-full rounded-2xl border-2 border-white/15 bg-white/[0.06] px-5 py-5 text-center text-3xl font-bold text-white placeholder:text-white/25 focus:border-fuchsia-400 focus:outline-none";

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-x-clip bg-ink-950 px-5 py-10 text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 [background:radial-gradient(70%_50%_at_50%_0%,rgba(232,121,249,0.22),transparent_70%)]"
      />
      <div className="relative w-full max-w-md">
        <p className="text-center font-mono text-sm font-bold tracking-[0.4em] text-fuchsia-300 uppercase">Booked!</p>

        {step !== "done" && (
          <div className="mt-4 flex items-center justify-center gap-2" aria-label={`Question ${step} of 3`}>
            {[1, 2, 3].map((n) => (
              <span
                key={n}
                className={cx(
                  "h-1.5 w-10 rounded-full transition-colors",
                  n <= step ? "bg-fuchsia-400" : "bg-white/15",
                )}
              />
            ))}
          </div>
        )}

        {/* Honeypot — invisible to people, irresistible to bots. */}
        <input
          type="text"
          name="company"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
          className="pointer-events-none absolute -left-[9999px] h-0 w-0 opacity-0"
        />

        {step === 1 && (
          <form
            key="q1"
            className="nl-rise mt-8 space-y-6"
            onSubmit={(e) => {
              e.preventDefault();
              next();
            }}
          >
            <h1 className="text-center font-display text-3xl font-black leading-tight">What is the MovePro Job Number?</h1>
            <input
              ref={inputRef}
              value={job}
              onChange={(e) => setJob(e.target.value.toUpperCase())}
              placeholder="e.g. 4EX6RD"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              autoComplete="off"
              maxLength={16}
              className={cx(field, "font-mono tracking-[0.2em] uppercase")}
            />
            {error && <p className="text-center text-sm font-semibold text-red-300">{error}</p>}
            <button type="submit" disabled={!jobOk} className={primary}>
              Next
            </button>
          </form>
        )}

        {step === 2 && (
          <form
            key="q2"
            className="nl-rise mt-8 space-y-6"
            onSubmit={(e) => {
              e.preventDefault();
              next();
            }}
          >
            <h1 className="text-center font-display text-3xl font-black leading-tight">What is your name?</h1>
            {submitters.length > 0 ? (
              <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Your name">
                {submitters.map((name) => (
                  <button
                    key={name}
                    type="button"
                    role="radio"
                    aria-checked={by === name}
                    onClick={() => setBy(name)}
                    className={cx(
                      "rounded-2xl border-2 px-3 py-3.5 text-lg font-bold transition active:scale-[0.97]",
                      by === name
                        ? "border-fuchsia-400 bg-fuchsia-400 text-ink-950 shadow-[0_0_24px_-4px_rgba(232,121,249,0.8)]"
                        : "border-white/15 bg-white/[0.06] text-white",
                    )}
                  >
                    {name}
                  </button>
                ))}
              </div>
            ) : (
              <input
                ref={inputRef}
                value={by}
                onChange={(e) => setBy(e.target.value)}
                placeholder="Your name"
                autoCapitalize="words"
                autoComplete="given-name"
                maxLength={40}
                className={field}
              />
            )}
            {/* Sticky so Next is always on screen, however many reps there are. */}
            <div className="sticky bottom-0 -mx-1 space-y-3 bg-gradient-to-t from-ink-950 via-ink-950 to-transparent px-1 pt-6 pb-3">
              <button type="submit" disabled={!nameOk} className={primary}>
                Next
              </button>
              <button type="button" onClick={() => setStep(1)} className="block w-full text-center text-sm font-semibold text-white/50">
                ← Back
              </button>
            </div>
          </form>
        )}

        {step === 3 && (
          <form
            key="q3"
            className="nl-rise mt-8 space-y-6"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <h1 className="text-center font-display text-3xl font-black leading-tight">Who are you booking this job for?</h1>
            {reps.length > 0 ? (
              <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Rep">
                {reps
                  .filter((name) => name !== by)
                  .map((name) => (
                  <button
                    key={name}
                    type="button"
                    role="radio"
                    aria-checked={forRep === name}
                    onClick={() => setForRep(name)}
                    className={cx(
                      "rounded-2xl border-2 px-3 py-3.5 text-lg font-bold transition active:scale-[0.97]",
                      forRep === name
                        ? "border-fuchsia-400 bg-fuchsia-400 text-ink-950 shadow-[0_0_24px_-4px_rgba(232,121,249,0.8)]"
                        : "border-white/15 bg-white/[0.06] text-white",
                    )}
                  >
                    {name}
                  </button>
                ))}
              </div>
            ) : (
              <input
                ref={inputRef}
                value={forRep}
                onChange={(e) => setForRep(e.target.value)}
                placeholder="Rep's name"
                autoCapitalize="words"
                maxLength={40}
                className={field}
              />
            )}
            {error && <p className="text-center text-sm font-semibold text-red-300">{error}</p>}
            {/* Sticky so Submit is always on screen, however many reps there are. */}
            <div className="sticky bottom-0 -mx-1 space-y-3 bg-gradient-to-t from-ink-950 via-ink-950 to-transparent px-1 pt-6 pb-3">
              <button type="submit" disabled={!repOk || sending} className={primary}>
                {sending ? "Sending…" : "Submit"}
              </button>
              <button type="button" onClick={() => setStep(2)} className="block w-full text-center text-sm font-semibold text-white/50">
                ← Back
              </button>
            </div>
          </form>
        )}

        {step === "done" && sent && (
          <div className="nl-pop mt-10 space-y-6 text-center">
            <p className="text-7xl" aria-hidden>
              🎉
            </p>
            <h1 className="font-display text-4xl font-black">Sent!</h1>
            <p className="text-lg text-white/70">
              <span className="font-mono font-bold text-fuchsia-300">#{sent.job}</span> for{" "}
              <span className="font-bold text-white">{sent.forRep}</span> is on the big screen now.
            </p>
            <button type="button" onClick={again} className={primary}>
              Book another
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
