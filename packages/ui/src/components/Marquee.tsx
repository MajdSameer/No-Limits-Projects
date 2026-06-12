import type { ReactNode } from "react";

import { cx } from "../cx";

export interface MarqueeProps {
  items: ReadonlyArray<ReactNode>;
  /** Rendered between items. */
  separator?: ReactNode;
  className?: string;
  /** Accessible name for the strip, e.g. "Routes we move". */
  label?: string;
}

/**
 * Slow, continuous ticker (CSS-only). The track is duplicated for a seamless
 * loop — the copy is aria-hidden. Pauses on hover; static when the visitor
 * prefers reduced motion.
 */
export function Marquee({ items, separator = "→", className, label }: MarqueeProps) {
  const row = (hidden: boolean) => (
    <ul
      aria-hidden={hidden || undefined}
      className="flex shrink-0 items-center motion-safe:animate-marquee motion-reduce:animate-none"
    >
      {items.map((item, i) => (
        <li key={i} className="flex items-center whitespace-nowrap">
          <span className="px-5">{item}</span>
          <span aria-hidden className="text-accent-400">
            {separator}
          </span>
        </li>
      ))}
    </ul>
  );

  return (
    <div
      role="marquee"
      aria-label={label}
      className={cx(
        "group flex overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)] hover:[&>ul]:[animation-play-state:paused]",
        className,
      )}
    >
      {row(false)}
      {row(true)}
    </div>
  );
}
