"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Re-fetches the server component on an interval so the /live board reflects
 * the latest pushed snapshot without a manual reload. The push itself is near
 * real-time; this just controls how often the wall display repaints.
 */
export function LiveRefresher({ everyMs = 10_000 }: { everyMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), everyMs);
    return () => clearInterval(id);
  }, [router, everyMs]);
  return null;
}
