"use client";

import { useActionState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

import { formatCurrency } from "@nlr/config/brand";
import { Button, SelectField, TextField, type ButtonProps } from "@nlr/ui";

import { quoteFlow } from "./actions";
import { MOVE_SIZES, type QuoteFlowState } from "./quote-options";

const INITIAL: QuoteFlowState = { step: "start" };

/**
 * The signature element: an instant ballpark price, served by the Movepro
 * adapter. Price first, contact details second — people share a phone number
 * much more readily once they've seen a number.
 */
export function QuoteCard() {
  const [state, formAction] = useActionState(quoteFlow, INITIAL);
  const estimate = state.estimate;

  return (
    // The conversion centerpiece as a manila consignment docket (council
    // pick): perforated tear-off top, mono field language, stamped result.
    <div className="relative overflow-hidden rounded-md bg-manila-100 shadow-2xl shadow-black/60">
      <div className="docket-perforation" aria-hidden />
      <div className="relative p-6 sm:p-7">
        <div
          aria-hidden
          className="pointer-events-none absolute top-5 -right-3 grid size-23 rotate-12 place-items-center rounded-full border-4 border-double border-accent-600 text-center font-mono text-[0.5rem] leading-snug font-bold tracking-[0.18em] text-accent-700 uppercase"
        >
          No Limits
          <br />
          Lansvale NSW
          <br />
          Est. 2016
        </div>
        <p className="font-mono text-[0.65rem] font-bold tracking-[0.3em] text-brand-700 uppercase">
          Consignment note
        </p>
        <h2 className="font-display mt-2 pr-16 text-3xl font-bold tracking-wide text-brand-950 uppercase">
          What would my move cost?
        </h2>
        <p className="mt-1 text-sm font-medium text-brand-900">
          A real ballpark in seconds — no phone number needed to see it.
        </p>

      {/* React 19 resets uncontrolled fields after the action runs, so feed
          the latest inputs back in as defaults to keep the form populated. */}
      <form action={formAction} className="mt-5 space-y-3">
        <input type="hidden" name="intent" value="estimate" />
        <SelectField
          // Remount when the estimated size changes — React won't update a
          // mounted select's defaultValue.
          key={state.input?.size ?? "initial"}
          id="size"
          name="size"
          label="Size of the move"
          defaultValue={state.input?.size ?? "2-bedroom"}
        >
          {MOVE_SIZES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </SelectField>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextField
            id="from"
            name="from"
            label="From suburb"
            placeholder="Parramatta"
            autoComplete="off"
            defaultValue={state.input?.from}
          />
          <TextField
            id="to"
            name="to"
            label="To suburb"
            placeholder="Newcastle"
            autoComplete="off"
            defaultValue={state.input?.to}
          />
        </div>
        <SubmitButton size="lg" className="w-full" pendingLabel="Calculating…">
          Show my estimate
        </SubmitButton>
        <p className="text-center text-xs font-semibold text-brand-900/75">
          Instant range · no account needed · obligation-free
        </p>
      </form>

      {state.error && (
        <p role="alert" className="mt-3 rounded-lg bg-white/70 px-3 py-2 text-sm font-semibold text-red-700">
          {state.error}
        </p>
      )}

      {estimate && state.input && (
        <div className="reveal mt-5 rounded-lg border border-manila-400 bg-white p-5">
          <div className="flex items-baseline justify-between gap-3">
            <p className="font-mono text-sm font-semibold text-slate-600">
              {state.input.from} → {state.input.to} · {state.input.sizeLabel}
            </p>
            {estimate.mock && (
              <span className="shrink-0 rounded-full bg-accent-100 px-2 py-0.5 text-[0.65rem] font-bold tracking-wide text-accent-800 uppercase">
                Demo pricing
              </span>
            )}
          </div>

          <p className="font-display mt-2 text-5xl font-bold tracking-wide text-brand-900">
            {formatCurrency(estimate.min)}–{formatCurrency(estimate.max)}
            <span className="ml-2 align-middle font-sans text-sm font-semibold text-slate-500">
              + GST
            </span>
          </p>
          <p className="mt-2 text-sm text-slate-600">
            {estimate.crew} movers · {estimate.truck} truck · about {estimate.hours} hours
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {estimate.minimumHours}-hour minimum plus {estimate.callout} callout.{" "}
            {formatCurrency(estimate.deposit ?? 0)} refundable deposit holds your date.
          </p>
          <p
            aria-hidden
            className="mt-3 inline-block rounded border-2 border-accent-600 px-2.5 py-1 font-mono text-[0.6rem] font-bold tracking-[0.25em] text-accent-700 uppercase motion-safe:animate-stamp"
          >
            ✓ Estimate issued
          </p>

          {state.step !== "requested" ? (
            <form action={formAction} className="mt-4 space-y-3 border-t border-slate-200 pt-4">
              <input type="hidden" name="intent" value="callback" />
              <input type="hidden" name="size" value={state.input.size} />
              <input type="hidden" name="from" value={state.input.from} />
              <input type="hidden" name="to" value={state.input.to} />
              <p className="text-sm font-bold text-brand-900">
                Happy with that? We&apos;ll call to confirm the exact price.
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <TextField id="name" name="name" label="First name" autoComplete="given-name" />
                <TextField
                  id="phone"
                  name="phone"
                  label="Phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="04xx xxx xxx"
                />
              </div>
              <SubmitButton variant="secondary" className="w-full" pendingLabel="Sending…">
                Request my exact quote
              </SubmitButton>
            </form>
          ) : (
            <p className="reveal mt-4 rounded-xl bg-brand-900 px-4 py-3 text-sm font-semibold text-white">
              Thanks {state.requestedBy} — your details are with our team.
              We&apos;ll call you to confirm pricing and lock in the date.
            </p>
          )}
        </div>
      )}
      </div>
    </div>
  );
}

/** Submit button that tracks its own form's pending state. */
function SubmitButton({
  pendingLabel,
  children,
  ...props
}: ButtonProps & { pendingLabel: string; children: ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} {...props}>
      {pending ? pendingLabel : children}
    </Button>
  );
}
