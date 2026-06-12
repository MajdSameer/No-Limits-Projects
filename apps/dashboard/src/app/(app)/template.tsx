"use client";

/** Re-mounts on every route change inside (app) → content fades up. */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
