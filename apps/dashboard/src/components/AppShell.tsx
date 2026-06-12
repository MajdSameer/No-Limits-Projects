import Link from "next/link";
import type { ReactNode } from "react";

import { signOut } from "../app/actions/auth";
import type { Session } from "../lib/session";
import { NavLinks } from "./NavLinks";
import { QuickAdd } from "./QuickAdd";

export function AppShell({ session, children }: { session: Session; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/85 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4">
          <Link
            href="/"
            className="flex items-baseline gap-2 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
          >
            <span className="font-display text-xl font-bold tracking-wide text-brand-900 uppercase">
              No Limits
            </span>
            <span className="rounded-full bg-accent-400 px-2 py-0.5 text-[0.6rem] font-bold tracking-widest text-brand-950 uppercase">
              Ops
            </span>
          </Link>

          <NavLinks isManager={session.role === "manager"} />

          <div className="flex items-center gap-3">
            <QuickAdd />
            <span className="hidden text-sm font-medium text-slate-500 sm:block">
              {session.name}
            </span>
            <form action={signOut}>
              <button
                type="submit"
                className="min-h-11 rounded-full border border-slate-200 px-4 text-sm font-semibold text-slate-600 transition-colors hover:border-brand-300 hover:text-brand-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* pb-24 reserves space for the fixed clock bar. */}
      <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 pt-8 pb-28">
        {children}
      </main>
    </div>
  );
}
