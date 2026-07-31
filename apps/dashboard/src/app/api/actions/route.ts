import { NextResponse } from "next/server";

import { getActionsSnapshot } from "../../../lib/movepro-actions";

export const dynamic = "force-dynamic";
// A true first-time month build (nothing in the durable day cache yet) is
// ~31 days at DASHCARD_CONCURRENCY (5) in flight, each ~6s once Metabase
// isn't being hit with an unbounded concurrent burst (confirmed via a since-
// removed diagnostic probe's ?concurrency mode) — ceil(31/5) * 6s ≈ 40s.
// 60s gives that genuine one-time cost room to finish; every poll after
// that only fetches today (~6s), since completed days come from the cache.
export const maxDuration = 60;

/**
 * Public by design, like /api/boards — the wall TV has no session. Serves
 * per-agent call/email/message activity from MovePro's Metabase report, from
 * a short in-memory cache (see movepro-actions) so polling tabs don't each
 * trigger a fresh month rebuild.
 */
export async function GET() {
  try {
    const data = await getActionsSnapshot();
    return NextResponse.json(data, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    console.error("GET /api/actions failed:", err);
    // Surfaced in the response (not just server logs) because this route has
    // no other diagnostics channel available when things go wrong — the
    // message is an HTTP status / response-shape description from our own
    // fetch code (see movepro-actions.ts), never customer or credential data.
    const detail = err instanceof Error ? err.message.slice(0, 300) : String(err).slice(0, 300);
    return NextResponse.json({ error: "Failed to load activity data", detail }, { status: 502 });
  }
}
