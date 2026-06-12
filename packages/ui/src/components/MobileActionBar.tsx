"use client";

import { useEffect, useState } from "react";

import { company } from "@nlr/config/brand";

import { cx } from "../cx";
import { ButtonLink } from "./Button";

export interface MobileActionBarProps {
  /**
   * Selector of the element this bar duplicates (the inline quote card).
   * The bar slides away while that element is on screen.
   */
  watch?: string;
  quoteHref?: string;
}

/**
 * Thumb-zone action bar for phones: Call + Get a quote, always one tap away.
 * Hidden on md+ (the hero quote card and header CTA cover it there). Pages
 * using it should add bottom padding (e.g. a h-24 md:hidden spacer) so the
 * footer is never obscured.
 */
export function MobileActionBar({ watch = "#quote", quoteHref = "#quote" }: MobileActionBarProps) {
  const [suppressed, setSuppressed] = useState(false);

  useEffect(() => {
    const target = document.querySelector(watch);
    if (!target) return;
    const io = new IntersectionObserver(
      ([entry]) => setSuppressed(Boolean(entry?.isIntersecting)),
      { threshold: 0.2 },
    );
    io.observe(target);
    return () => io.disconnect();
  }, [watch]);

  return (
    <div
      inert={suppressed}
      className={cx(
        "fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-4 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] shadow-[0_-4px_16px_rgba(15,25,47,0.08)] backdrop-blur transition-transform duration-300 md:hidden",
        suppressed && "translate-y-full",
      )}
    >
      <div className="mx-auto grid max-w-md grid-cols-2 gap-3">
        <ButtonLink href={`tel:${company.phone}`} variant="secondary">
          Call now
        </ButtonLink>
        <ButtonLink href={quoteHref} variant="primary">
          Get a quote
        </ButtonLink>
      </div>
    </div>
  );
}
