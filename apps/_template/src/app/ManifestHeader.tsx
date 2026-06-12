"use client";

import Link from "next/link";
import { useState } from "react";

import { company } from "@nlr/config/brand";
import { ButtonLink, Container, cx } from "@nlr/ui";

export interface ManifestNavItem {
  label: string;
  href: string;
}

/**
 * App-local dark header for the FREIGHT MANIFEST art direction. The shared
 * @nlr/ui Header stays the canonical (light) one for other apps.
 */
export function ManifestHeader({ nav }: { nav: ManifestNavItem[] }) {
  const [open, setOpen] = useState(false);

  const callCta = (
    <ButtonLink href={`tel:${company.phone}`} variant="secondary" size="sm">
      Call {company.phoneDisplay}
    </ButtonLink>
  );

  return (
    <header className="sticky top-0 z-40 border-b-2 border-accent-400 bg-ink-950/95 backdrop-blur">
      <Container>
        <div className="flex h-16 items-center justify-between gap-4">
          <Link
            href="/"
            aria-label={`${company.name} — home`}
            className="rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-400"
          >
            <span className="flex flex-col leading-none">
              <span className="font-display text-xl font-bold tracking-wide text-manila-100 uppercase">
                No Limits
              </span>
              <span className="mt-0.5 font-mono text-[0.55rem] font-bold tracking-[0.3em] text-accent-400 uppercase">
                Removalists · Lansvale
              </span>
            </span>
          </Link>

          <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
            {nav.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="relative rounded px-3 py-2 font-mono text-xs font-bold tracking-[0.2em] text-manila-200 uppercase transition-colors after:absolute after:inset-x-3 after:bottom-0.5 after:h-0.5 after:origin-left after:scale-x-0 after:bg-accent-400 after:transition-transform after:duration-300 hover:text-accent-300 hover:after:scale-x-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-400"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="hidden md:block">{callCta}</div>

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="manifest-nav"
            className="grid size-11 place-items-center rounded text-manila-100 hover:bg-ink-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-400 md:hidden"
          >
            <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
            <svg
              aria-hidden
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              className="size-6"
            >
              {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>
      </Container>

      <div
        id="manifest-nav"
        className={cx(
          "border-t border-ink-900 [animation-duration:250ms] md:hidden motion-safe:animate-fade-up",
          !open && "hidden",
        )}
      >
        <Container>
          <nav aria-label="Main menu" className="flex flex-col gap-1 py-3">
            {nav.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded px-3 py-3 font-mono text-sm font-bold tracking-[0.2em] text-manila-100 uppercase hover:bg-ink-900"
              >
                {item.label}
              </a>
            ))}
            <div className="px-3 pt-2 pb-1">{callCta}</div>
          </nav>
        </Container>
      </div>
    </header>
  );
}
