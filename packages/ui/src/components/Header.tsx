"use client";

import { useState } from "react";

import { company } from "@nlr/config/brand";

import { cx } from "../cx";
import { ButtonLink } from "./Button";
import { Container } from "./Container";
import { Logo } from "./Logo";

export interface NavItem {
  label: string;
  href: string;
}

export interface HeaderProps {
  nav?: NavItem[];
  /** Set false to hide the call-now button. */
  showPhone?: boolean;
}

/**
 * Sticky branded header with mobile menu. Uses plain anchors so it works in
 * any app; for high-traffic internal navigation, prefer next/link in app code.
 */
export function Header({ nav = [], showPhone = true }: HeaderProps) {
  const [open, setOpen] = useState(false);

  // Gold pill, like the website's "Request a Quote" header button.
  const phoneCta = showPhone && (
    <ButtonLink href={`tel:${company.phone}`} variant="secondary" size="sm">
      <PhoneIcon />
      Call {company.phoneDisplay}
    </ButtonLink>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <Container>
        <div className="flex h-16 items-center justify-between gap-4">
          <a
            href="/"
            aria-label={`${company.name} — home`}
            className="rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
          >
            <Logo />
          </a>

          <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
            {nav.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="rounded-lg px-3 py-2 font-medium text-brand-900 hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="hidden md:block">{phoneCta}</div>

          {nav.length > 0 && (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls="mobile-nav"
              className="grid size-11 place-items-center rounded-lg text-brand-900 hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 md:hidden"
            >
              <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
              <MenuIcon open={open} />
            </button>
          )}
          {nav.length === 0 && <div className="md:hidden">{phoneCta}</div>}
        </div>
      </Container>

      <div
        id="mobile-nav"
        className={cx(
          "border-t border-slate-200 [animation-duration:250ms] md:hidden motion-safe:animate-fade-up",
          !open && "hidden",
        )}
      >
        <Container>
          <nav aria-label="Main menu" className="flex flex-col gap-1 py-3">
            {nav.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="rounded-lg px-3 py-3 font-medium text-brand-900 hover:bg-brand-50"
              >
                {item.label}
              </a>
            ))}
            <div className="px-3 pt-2 pb-1">{phoneCta}</div>
          </nav>
        </Container>
      </div>
    </header>
  );
}

function PhoneIcon() {
  return (
    <svg aria-hidden viewBox="0 0 20 20" fill="currentColor" className="size-4">
      <path d="M2 3.5A1.5 1.5 0 0 1 3.5 2h1.148a1.5 1.5 0 0 1 1.465 1.175l.716 3.223a1.5 1.5 0 0 1-1.052 1.767l-.933.267c-.41.117-.643.555-.48.95a11.542 11.542 0 0 0 6.254 6.254c.395.163.833-.07.95-.48l.267-.933a1.5 1.5 0 0 1 1.767-1.052l3.223.716A1.5 1.5 0 0 1 18 15.352V16.5a1.5 1.5 0 0 1-1.5 1.5H15C7.82 18 2 12.18 2 5V3.5Z" />
    </svg>
  );
}

function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className="size-6"
    >
      {open ? (
        <path d="M6 6l12 12M18 6L6 18" />
      ) : (
        <path d="M4 7h16M4 12h16M4 17h16" />
      )}
    </svg>
  );
}
