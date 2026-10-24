"use client";

import { useEffect, useRef } from "react";

import { createClient } from "@supabase/supabase-js";

import type { LiveScope } from "./notify";

const VERSION_CHECK_MS = 60_000;
/** undefined = not checked yet; null = no deployment id available (e.g. dev). */
let knownDeploymentId: string | null | undefined;

/**
 * Wall displays (/live, /tv, /, /live/game-day) sit open in one browser tab
 * for days. Polling refetches DATA, but a merged code fix (like a celebration
 * sound bug) only reaches an already-open tab on a real page reload — nothing
 * was ever forcing one, so a deployed fix could sit live indefinitely without
 * reaching the actual screen. A reload here is cheap: these boards have no
 * session/inputs to lose.
 */
function checkForNewDeploy(): void {
  fetch("/api/version", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : null))
    .then((d: { deploymentId: string | null } | null) => {
      if (!d || !d.deploymentId) return;
      if (knownDeploymentId === undefined) knownDeploymentId = d.deploymentId;
      else if (knownDeploymentId !== d.deploymentId) window.location.reload();
    })
    .catch(() => undefined);
}

/**
 * Keeps a view current: refetches on Supabase broadcast pings (when env is
 * configured) AND every 3 seconds regardless — realtime is an enhancement,
 * polling is the guarantee. Also reloads the page if a new deploy has landed.
 */
export function useLiveRefresh(scopes: LiveScope[], refetch: () => void, intervalMs = 3000): void {
  const cb = useRef(refetch);
  cb.current = refetch;
  const scopeKey = scopes.join(",");

  useEffect(() => {
    checkForNewDeploy();
    const versionInterval = setInterval(checkForNewDeploy, VERSION_CHECK_MS);
    return () => clearInterval(versionInterval);
  }, []);

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
