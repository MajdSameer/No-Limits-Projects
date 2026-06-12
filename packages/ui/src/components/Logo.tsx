"use client";

import { useEffect, useRef, useState } from "react";

import { company } from "@nlr/config/brand";

import { cx } from "../cx";

export interface LogoProps {
  className?: string;
  /**
   * Image logo (e.g. company.logoAnimatedUrl). Only use on light surfaces —
   * the real logo is navy artwork. If the image fails to load, the text
   * lockup below renders instead, so a dead URL never leaves a blank header.
   */
  src?: string;
}

export function Logo({ className, src }: LogoProps) {
  const [failed, setFailed] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // The SSR'd <img> can error before hydration attaches onError — catch
  // already-failed images after mount so the fallback still kicks in.
  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth === 0) setFailed(true);
  }, []);

  if (src && !failed) {
    return (
      // Plain <img>: the animated GIF must not go through image optimization.
      <img
        ref={imgRef}
        src={src}
        alt={company.name}
        className={cx("h-10 w-auto", className)}
        onError={() => setFailed(true)}
      />
    );
  }

  // Text lockup fallback — mirrors the real logo's stacked wordmark.
  return (
    <span className={cx("inline-flex items-center gap-2.5", className)}>
      <span
        aria-hidden
        className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-900 text-sm font-black text-white"
      >
        NL
      </span>
      <span className="flex flex-col justify-center leading-none">
        <span className="text-base font-extrabold tracking-tight text-brand-900">
          NO LIMITS
        </span>
        <span className="mt-1 text-[0.65rem] font-bold tracking-[0.24em] text-brand-600">
          REMOVALISTS
        </span>
      </span>
    </span>
  );
}
