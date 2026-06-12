"use client";

import confetti from "canvas-confetti";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";

import { cx } from "@nlr/ui";

import { quickAdd } from "../app/actions/bookings";
import { BOOKING_TYPES, type BookingTypeInput, type CreateResult } from "../lib/bookings-shared";
import { sydneyToday } from "../lib/sydney";

const TYPE_LABEL: Record<BookingTypeInput, string> = {
  moving: "Moving",
  storage: "Storage",
  cleaning: "Cleaning",
  car: "Car",
};

const inputCls =
  "min-h-11 w-full border border-manila-400 bg-white px-3 text-brand-950 placeholder:text-slate-400 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-600";
const labelCls = "mb-1 block font-mono text-[0.6rem] font-bold tracking-[0.25em] text-brand-700 uppercase";

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
        className="m-auto w-full max-w-lg bg-manila-100 p-0 shadow-2xl shadow-black/60 backdrop:bg-ink-950/80"
      >
        <div className="docket-perforation" aria-hidden />
        <div className="p-6">
          {result?.ok ? (
            <div className="text-center">
              <p className="font-mono text-[0.65rem] font-bold tracking-[0.3em] text-brand-700 uppercase">
                On the board
              </p>
              <p className="font-display mt-2 text-4xl font-bold tracking-wide text-brand-950 uppercase">
                {result.jobNumber} 🎉
              </p>
              <p className="mt-2 text-sm text-brand-900">
                Counted for today.{" "}
                <Link href={`/bookings/${result.id}`} className="font-semibold underline decoration-accent-500 decoration-2 underline-offset-2" onClick={close}>
                  Complete the details
                </Link>{" "}
                when you're off the phone.
              </p>
              <div className="mt-5 flex justify-center gap-3">
                <button type="button" onClick={() => setResult(null)} className="min-h-11 rounded-full bg-brand-900 px-5 font-mono text-xs font-bold tracking-widest text-white uppercase hover:bg-brand-800">
                  Add another
                </button>
                <button type="button" onClick={close} className="min-h-11 rounded-full border border-brand-900 px-5 font-mono text-xs font-bold tracking-widest text-brand-900 uppercase hover:bg-manila-200">
                  Done
                </button>
              </div>
            </div>
          ) : (
            <form ref={formRef} action={submit}>
              <div className="flex items-start justify-between gap-4">
                <h2 className="font-display text-2xl font-bold tracking-wide text-brand-950 uppercase">
                  Log a booking
                </h2>
                <button type="button" onClick={close} aria-label="Close" className="grid size-11 place-items-center text-brand-700 hover:text-brand-950">
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
                          "min-h-11 border font-mono text-[0.65rem] font-bold tracking-widest uppercase",
                          type === t ? "border-brand-950 bg-brand-950 text-accent-400" : "border-manila-400 bg-white text-brand-900 hover:border-brand-700",
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

                <button type="button" onClick={() => setMoreOpen((v) => !v)} aria-expanded={moreOpen} className="text-left font-mono text-[0.65rem] font-bold tracking-[0.25em] text-brand-700 uppercase underline-offset-4 hover:underline">
                  {moreOpen ? "− Less" : "+ More details (customer, suburbs, $)"}
                </button>

                {moreOpen && (
                  <div className="grid grid-cols-2 gap-3">
                    <div><label htmlFor="qa-name" className={labelCls}>Customer</label><input id="qa-name" name="customerName" className={inputCls} /></div>
                    <div><label htmlFor="qa-phone" className={labelCls}>Phone</label><input id="qa-phone" name="customerPhone" type="tel" className={inputCls} /></div>
                    <div><label htmlFor="qa-pickup" className={labelCls}>Pickup</label><input id="qa-pickup" name="pickup" className={inputCls} /></div>
                    <div><label htmlFor="qa-delivery" className={labelCls}>Delivery</label><input id="qa-delivery" name="delivery" className={inputCls} /></div>
                    <div><label htmlFor="qa-value" className={labelCls}>Value $</label><input id="qa-value" name="value" inputMode="decimal" className={inputCls} /></div>
                    <div><label htmlFor="qa-deposit" className={labelCls}>Deposit $</label><input id="qa-deposit" name="deposit" inputMode="decimal" className={inputCls} /></div>
                  </div>
                )}

                {result && !result.ok && (
                  <p role="alert" className="border-2 border-brand-900 bg-white px-3 py-2 text-sm font-semibold text-brand-950">
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

                <button type="submit" disabled={pending} className={cx("min-h-12 rounded-full bg-brand-900 font-mono text-sm font-bold tracking-widest text-white uppercase hover:bg-brand-800", pending && "opacity-60")}>
                  {pending ? "Logging…" : "Log it"}
                </button>
              </div>
            </form>
          )}
        </div>
      </dialog>
    </>
  );
}
