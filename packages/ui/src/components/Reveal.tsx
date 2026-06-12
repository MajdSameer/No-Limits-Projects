"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

import { cx } from "../cx";

const EFFECTS = {
  "fade-up": "translate-y-5 opacity-0",
  "fade-left": "translate-x-6 opacity-0",
  "grow-x": "scale-x-0 opacity-0",
  fade: "opacity-0",
} as const;

export interface RevealProps {
  children?: ReactNode;
  /** Milliseconds to wait once in view — use for stagger. */
  delay?: number;
  effect?: keyof typeof EFFECTS;
  className?: string;
  style?: CSSProperties;
}

/**
 * Scroll-triggered reveal. Progressive by design: server-rendered visible
 * (no-JS and SEO safe), hidden only after mount and only when the element
 * starts below the fold, and skipped entirely for prefers-reduced-motion.
 */
export function Reveal({ children, delay = 0, effect = "fade-up", className, style }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [hidden, setHidden] = useState(false);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Already on screen at load — animating it would just delay the content.
    if (el.getBoundingClientRect().top < window.innerHeight * 0.92) return;

    setHidden(true);
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{ ...style, transitionDelay: delay ? `${delay}ms` : undefined }}
      className={cx(
        "transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]",
        effect === "grow-x" && "origin-left",
        hidden && !shown && EFFECTS[effect],
        className,
      )}
    >
      {children}
    </div>
  );
}
