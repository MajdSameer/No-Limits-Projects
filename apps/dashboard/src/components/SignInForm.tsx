"use client";

import { useActionState, useState } from "react";

import { cx } from "@nlr/ui";

import { signIn, type SignInState } from "../app/actions/auth";

interface StaffOption {
  id: string;
  name: string;
  role: "rep" | "manager";
}

const PIN_ERRORS: Record<NonNullable<SignInState["error"]>, string> = {
  "wrong-pin": "Wrong PIN — try again.",
  locked: "Account locked after too many attempts. Ask a manager to unlock you.",
  unavailable: "Can't sign you in right now — get a manager.",
};

export function SignInForm({ staff }: { staff: StaffOption[] }) {
  const [selected, setSelected] = useState<StaffOption | null>(null);
  const [pin, setPin] = useState("");
  const [state, formAction, pending] = useActionState(signIn, {} as SignInState);

  if (!selected) {
    return (
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-label="Pick your name">
        {staff.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => {
                setSelected(s);
                setPin("");
              }}
              className="flex min-h-18 w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            >
              <span
                aria-hidden
                className="grid size-10 shrink-0 place-items-center rounded-full bg-accent-400 text-sm font-bold text-brand-950"
              >
                {s.name.slice(0, 2).toUpperCase()}
              </span>
              <span>
                <span className="block font-bold text-brand-900">{s.name}</span>
                {s.role === "manager" && (
                  <span className="text-[0.65rem] font-bold tracking-widest text-accent-800 uppercase">
                    Manager
                  </span>
                )}
              </span>
            </button>
          </li>
        ))}
      </ul>
    );
  }

  const digits = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "back", "0", "go"] as const;

  return (
    <form action={formAction} className="mx-auto w-full max-w-xs">
      <input type="hidden" name="staffId" value={selected.id} />
      <input type="hidden" name="pin" value={pin} />

      <div className="mb-4 flex items-center justify-between">
        <p className="font-bold text-brand-900">{selected.name}</p>
        <button
          type="button"
          onClick={() => setSelected(null)}
          className="rounded-full px-3 py-1 text-sm font-medium text-slate-500 hover:text-brand-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        >
          ← Not you?
        </button>
      </div>

      <output
        aria-label="PIN entry"
        className="mb-4 grid h-14 place-items-center rounded-2xl border border-slate-200 bg-white font-mono text-3xl tracking-[0.5em] text-brand-900 shadow-sm"
      >
        {pin ? "•".repeat(pin.length) : <span className="text-slate-500">PIN</span>}
      </output>

      {state.error && (
        <p role="alert" className="fade-in mb-4 rounded-xl border border-accent-500 bg-accent-50 px-3 py-2 text-sm font-semibold text-brand-900">
          {PIN_ERRORS[state.error]}
        </p>
      )}

      <div className="grid grid-cols-3 gap-2">
        {digits.map((d) =>
          d === "back" ? (
            <button
              key={d}
              type="button"
              onClick={() => setPin((p) => p.slice(0, -1))}
              className="min-h-14 rounded-2xl border border-slate-200 bg-white font-mono text-lg text-slate-500 shadow-sm transition-colors hover:border-brand-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            >
              <span className="sr-only">Delete digit</span>⌫
            </button>
          ) : d === "go" ? (
            <button
              key={d}
              type="submit"
              disabled={pin.length < 4 || pending}
              className={cx(
                "min-h-14 rounded-2xl font-mono text-lg font-bold uppercase transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600",
                pin.length >= 4 && !pending
                  ? "bg-brand-900 text-white shadow-sm hover:bg-brand-800"
                  : "cursor-not-allowed border border-slate-200 bg-white text-slate-500",
              )}
            >
              {pending ? "…" : "Go"}
            </button>
          ) : (
            <button
              key={d}
              type="button"
              onClick={() => setPin((p) => (p.length < 6 ? p + d : p))}
              className="min-h-14 rounded-2xl border border-slate-200 bg-white font-mono text-xl text-brand-900 shadow-sm transition-colors hover:border-brand-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            >
              {d}
            </button>
          ),
        )}
      </div>
    </form>
  );
}
