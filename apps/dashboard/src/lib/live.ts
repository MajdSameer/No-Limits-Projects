"use client";

import { useEffect, useRef } from "react";

import { createClient } from "@supabase/supabase-js";

import type { LiveScope } from "./notify";

/**
 * Keeps a view current: refetches on Supabase broadcast pings (when env is
 * configured) AND every 3 seconds regardless — realtime is an enhancement,
 * polling is the guarantee.
 */
export function useLiveRefresh(scopes: LiveScope[], refetch: () => void, intervalMs = 3000): void {
  const cb = useRef(refetch);
  cb.current = refetch;
  const scopeKey = scopes.join(",");

  useEffect(() => {
    const interval = setInterval(() => cb.current(), intervalMs);

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return () => clearInterval(interval);

    const client = createClient(url, key);
    const channel = client.channel("nl-ops");
    channel
      .on("broadcast", { event: "changed" }, (message) => {
        const scope = String((message.payload as { scope?: string } | undefined)?.scope ?? "");
        if (scopeKey.split(",").includes(scope)) cb.current();
      })
      .subscribe();

    return () => {
      clearInterval(interval);
      void client.removeChannel(channel);
    };
  }, [scopeKey, intervalMs]);
}
