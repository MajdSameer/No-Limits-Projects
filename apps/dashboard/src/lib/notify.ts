/**
 * Fire-and-forget realtime ping. Carries NO row data — just "this scope
 * changed, refetch". Clients also poll every 3s, so a lost ping (or no
 * Supabase env at all) only ever costs a couple of seconds of freshness.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null | undefined;

function getClient(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  client = url && key ? createClient(url, key) : null;
  return client;
}

export type LiveScope = "bookings" | "clock" | "roster" | "staff";

export function notify(scope: LiveScope): void {
  const c = getClient();
  if (!c) return;
  try {
    const channel = c.channel("nl-ops");
    void channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        void channel
          .send({ type: "broadcast", event: "changed", payload: { scope } })
          .finally(() => void c.removeChannel(channel));
      }
    });
  } catch (err) {
    console.error("notify failed", scope, err);
  }
}
