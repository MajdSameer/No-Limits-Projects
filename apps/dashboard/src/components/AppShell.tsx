import Link from "next/link";
import type { ReactNode } from "react";

import { signOut } from "../app/actions/auth";
import type { Session } from "../lib/session";

const NAV = [
  { label: "Board", href: "/" },
  { label: "Bookings", href: "/bookings" },
  { label: "Roster", href: "/roster" },
];

export function AppShell({ session, children }: { session: Session; children: ReactNode }) {
  const nav = session.role === "manager" ? [...NAV, { label: "Manage", href: "/manage" }] : NAV;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b-2 border-accent-400 bg-ink-950/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between gap-4 px-4">
          <Link
            href="/"
            className="flex items-baseline gap-2 rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-400"
          >
            <span className="font-display text-lg font-bold tracking-wide text-manila-100 uppercase">
              No Limits
            </span>
            <span className="font-mono text-[0.6rem] font-bold tracking-[0.3em] text-accent-400 uppercase">
              Ops
            </span>
          </Link>

          <nav aria-label="Main" className="flex items-center gap-1">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded px-3 py-2 font-mono text-xs font-bold tracking-[0.18em] text-manila-200 uppercase transition-colors hover:text-accent-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-400"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <span className="hidden font-mono text-xs text-brand-300 sm:block">{session.name}</span>
            <form action={signOut}>
              <button
                type="submit"
                className="min-h-11 rounded border border-brand-800 px-3 font-mono text-xs font-bold tracking-widest text-brand-300 uppercase hover:border-accent-400 hover:text-accent-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-400"
              >
                Out
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* pb-20 reserves space for the fixed clock bar. */}
      <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 pt-6 pb-24">
        {children}
      </main>
    </div>
  );
}
