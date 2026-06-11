import { cx } from "../cx";

/**
 * Text-based logo lockup — stands in for the real logo (a navy truck
 * illustration over a stacked "NO LIMITS / REMOVALISTS" wordmark, all navy)
 * until we get the file (see TODO.md). Swap the inner markup for an
 * <img>/<svg> then.
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
        <span className="mt-1 text-[0.65rem] font-bold tracking-[0.24em] text-brand-600">
          REMOVALISTS
        </span>
      </span>
    </span>
  );
}
