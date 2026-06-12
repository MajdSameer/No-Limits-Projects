"use client";

import confetti from "canvas-confetti";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";

import { cx } from "@nlr/ui";

import { quickAdd } from "../app/actions/bookings";
import { BOOKING_TYPES, type BookingTypeInput, type CreateResult } from "../lib/bookings-shared";
import { SUBURBS } from "../lib/au-locations";
import { sydneyToday } from "../lib/sydney";

const TYPE_LABEL: Record<BookingTypeInput, string> = {
  moving: "Moving",
  storage: "Storage",
  cleaning: "Cleaning",
  car: "Car",
};

const inputCls =
  "min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-brand-950 shadow-sm transition-colors placeholder:text-slate-400 hover:border-slate-300 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-600";
const labelCls = "mb-1 block text-xs font-semibold text-slate-500";

export function QuickAdd() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [type, setType] = useState<BookingTypeInput>("moving");
  const [moreOpen, setMoreOpen] = useState(false);
  const [result, setResult] = useState<CreateResult | null>(null);
  const [pending, startTransition] = useTransition();

  const open = () => {
    setResult(null);
    dialogRef.current?.showModal();
  };
  const close = () => dialogRef.current?.close();

  const submit = (formData: FormData) => {
    startTransition(async () => {
      const r = await quickAdd({
        jobNumber: String(formData.get("jobNumber") ?? ""),
        type,
        moveDate: String(formData.get("moveDate") ?? ""),
        customerName: String(formData.get("customerName") ?? ""),
        customerPhone: String(formData.get("customerPhone") ?? ""),
        pickup: String(formData.get("pickup") ?? ""),
        delivery: String(formData.get("delivery") ?? ""),
        value: String(formData.get("value") ?? ""),
        deposit: String(formData.get("deposit") ?? ""),
      });
      setResult(r);
      if (r.ok) {
        formRef.current?.reset();
        if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
          confetti({ particleCount: 90, spread: 70, origin: { y: 0.3 }, colors: ["#ffd42e", "#f4f1e8", "#182646"] });
        }
      }
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={open}
        className="min-h-11 rounded-full bg-accent-400 px-5 font-mono text-xs font-bold tracking-widest text-ink-950 uppercase transition-all hover:bg-accent-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-400 motion-safe:hover:-translate-y-0.5"
      >
        + Job
      </button>

      <dialog
        ref={dialogRef}
        className="m-auto w-full max-w-lg rounded-3xl bg-white p-0 shadow-2xl shadow-brand-950/20"
      >
        <div aria-hidden className="h-1.5 rounded-t-3xl bg-accent-400" />
        <div className="p-6">
          {result?.ok ? (
            <div className="text-center">
              <p className="text-xs font-bold tracking-[0.2em] text-accent-600 uppercase">On the board</p>
              <p className="font-display fade-in mt-2 text-4xl font-bold tracking-wide text-brand-950 uppercase">
                {result.jobNumber} 🎉
              </p>
              <p className="mt-2 text-sm text-slate-600">
                Counted for today.{" "}
                <Link href={`/bookings/${result.id}`} className="font-semibold text-brand-800 underline decoration-accent-500 decoration-2 underline-offset-2" onClick={close}>
                  Complete the details
                </Link>{" "}
                when you're off the phone.
              </p>
              <div className="mt-5 flex justify-center gap-3">
                <button type="button" onClick={() => setResult(null)} className="min-h-11 rounded-full bg-brand-900 px-5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-brand-800 motion-safe:hover:-translate-y-0.5">
                  Add another
                </button>
                <button type="button" onClick={close} className="min-h-11 rounded-full border border-slate-200 px-5 text-sm font-semibold text-brand-900 transition-colors hover:border-brand-300">
                  Done
                </button>
              </div>
            </div>
          ) : (
            <form ref={formRef} action={submit}>
              <div className="flex items-start justify-between gap-4">
                <h2 className="text-xl font-bold text-brand-950">Log a booking</h2>
                <button type="button" onClick={close} aria-label="Close" className="grid size-11 place-items-center rounded-full text-slate-600 transition-colors hover:bg-slate-100 hover:text-brand-950">
                  ✕
                </button>
              </div>

              <div className="mt-4 grid gap-3">
                <div>
                  <label htmlFor="qa-job" className={labelCls}>MovePro job number *</label>
                  <input id="qa-job" name="jobNumber" required autoFocus placeholder="98RRX" className={cx(inputCls, "font-mono uppercase")} />
                </div>

                <fieldset>
                  <legend className={labelCls}>Type *</legend>
                  <div className="grid grid-cols-4 gap-1">
                    {BOOKING_TYPES.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setType(t)}
                        aria-pressed={type === t}
                        className={cx(
                          "min-h-11 rounded-xl border text-xs font-semibold transition-all duration-200",
                          type === t ? "border-brand-900 bg-brand-900 text-white shadow-sm" : "border-slate-200 bg-white text-slate-600 hover:border-brand-300",
                        )}
                      >
                        {TYPE_LABEL[t]}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <div>
                  <label htmlFor="qa-date" className={labelCls}>Move date *</label>
                  <input id="qa-date" name="moveDate" type="date" required defaultValue={sydneyToday()} className={inputCls} />
                </div>

                <button type="button" onClick={() => setMoreOpen((v) => !v)} aria-expanded={moreOpen} className="rounded-lg text-left text-sm font-semibold text-brand-700 underline-offset-4 transition-colors hover:text-brand-900 hover:underline">
                  {moreOpen ? "− Less" : "+ More details (customer, suburbs, $)"}
                </button>

                {moreOpen && (
                  <div className="fade-in grid grid-cols-2 gap-3">
                    <div><label htmlFor="qa-name" className={labelCls}>Customer</label><input id="qa-name" name="customerName" className={inputCls} /></div>
                    <div><label htmlFor="qa-phone" className={labelCls}>Phone</label><input id="qa-phone" name="customerPhone" type="tel" className={inputCls} /></div>
                    <div><label htmlFor="qa-pickup" className={labelCls}>Pickup suburb</label><input id="qa-pickup" name="pickup" list="au-suburbs" placeholder="Start typing…" className={inputCls} /></div>
                    <div><label htmlFor="qa-delivery" className={labelCls}>Delivery suburb</label><input id="qa-delivery" name="delivery" list="au-suburbs" placeholder="Start typing…" className={inputCls} /></div>
                    <div><label htmlFor="qa-value" className={labelCls}>Value $</label><input id="qa-value" name="value" inputMode="decimal" className={inputCls} /></div>
                    <div><label htmlFor="qa-deposit" className={labelCls}>Deposit $</label><input id="qa-deposit" name="deposit" inputMode="decimal" className={inputCls} /></div>
                  </div>
                )}

                {result && !result.ok && (
                  <p role="alert" className="fade-in rounded-xl border border-accent-500 bg-accent-50 px-3 py-2 text-sm font-semibold text-brand-950">
                    {result.error === "duplicate" ? (
                      <>
                        Already entered by {result.byName}.{" "}
                        <Link href={`/bookings/${result.existingId}`} className="underline decoration-accent-500 decoration-2" onClick={close}>
                          Open it
                        </Link>
                      </>
                    ) : (
                      result.message
                    )}
                  </p>
                )}

                <button type="submit" disabled={pending} className={cx("min-h-12 rounded-full bg-brand-900 text-sm font-bold text-white shadow-sm transition-all hover:bg-brand-800 motion-safe:hover:-translate-y-0.5", pending && "opacity-60")}>
                  {pending ? "Logging…" : "Log it"}
                </button>
              </div>
            </form>
          )}
        </div>
        <datalist id="au-suburbs">
          {SUBURBS.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </dialog>
    </>
  );
}
