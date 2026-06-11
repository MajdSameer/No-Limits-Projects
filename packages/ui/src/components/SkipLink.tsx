/**
 * Keyboard users' first tab stop — jumps past the header to the main content.
 * Pair with <main id="main"> (the app template does this already).
 */
export function SkipLink({ href = "#main" }: { href?: string }) {
  return (
    <a
      href={href}
      className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-brand-900 focus:px-4 focus:py-2 focus:font-semibold focus:text-white"
    >
      Skip to main content
    </a>
  );
}
