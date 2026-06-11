import { cx } from "../cx";

/**
 * Text-based logo lockup — placeholder until the real logo file arrives
 * (see TODO.md). Swap the inner markup for an <img>/<svg> then.
 */
export function Logo({ className }: { className?: string }) {
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
        <span className="mt-1 text-[0.65rem] font-bold tracking-[0.24em] text-accent-700">
          REMOVALISTS
        </span>
      </span>
    </span>
  );
}
