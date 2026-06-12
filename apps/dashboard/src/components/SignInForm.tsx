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
              className="flex min-h-18 w-full items-center gap-3 border border-brand-800 bg-ink-900 px-4 py-3 text-left transition-colors hover:border-accent-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-400"
            >
              <span
                aria-hidden
                className="grid size-10 shrink-0 place-items-center bg-accent-400 font-mono text-sm font-bold text-ink-950"
              >
                {s.name.slice(0, 2).toUpperCase()}
              </span>
              <span>
                <span className="block font-bold text-manila-100">{s.name}</span>
                {s.role === "manager" && (
                  <span className="font-mono text-[0.6rem] tracking-widest text-accent-400 uppercase">
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
        <p className="font-bold text-manila-100">{selected.name}</p>
        <button
          type="button"
          onClick={() => setSelected(null)}
          className="rounded px-2 py-1 font-mono text-xs tracking-widest text-brand-300 uppercase hover:text-accent-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-400"
        >
          ← Not you?
        </button>
      </div>

      <output
        aria-label="PIN entry"
        className="mb-4 grid h-14 place-items-center border border-brand-800 bg-ink-900 font-mono text-3xl tracking-[0.5em] text-manila-100"
      >
        {pin ? "•".repeat(pin.length) : <span className="text-brand-400">PIN</span>}
      </output>

      {state.error && (
        <p role="alert" className="mb-4 border border-accent-400 bg-ink-900 px-3 py-2 text-sm font-semibold text-accent-300">
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
              className="min-h-14 border border-brand-800 font-mono text-lg text-brand-300 hover:border-accent-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-400"
            >
              <span className="sr-only">Delete digit</span>⌫
            </button>
          ) : d === "go" ? (
            <button
              key={d}
              type="submit"
              disabled={pin.length < 4 || pending}
              className={cx(
                "min-h-14 font-mono text-lg font-bold uppercase focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-400",
                pin.length >= 4 && !pending
                  ? "bg-accent-400 text-ink-950 hover:bg-accent-300"
                  : "cursor-not-allowed border border-brand-800 text-brand-400",
              )}
            >
              {pending ? "…" : "Go"}
            </button>
          ) : (
            <button
              key={d}
              type="button"
              onClick={() => setPin((p) => (p.length < 6 ? p + d : p))}
              className="min-h-14 border border-brand-800 font-mono text-xl text-manila-100 hover:border-accent-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-400"
            >
              {d}
            </button>
          ),
        )}
      </div>
    </form>
  );
}
