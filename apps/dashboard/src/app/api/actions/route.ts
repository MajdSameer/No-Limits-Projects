import { NextResponse } from "next/server";

import { getActionsSnapshot } from "../../../lib/movepro-actions";

export const dynamic = "force-dynamic";
// A cold instance's monthly assembly is ~30 external requests, parallelized;
// give it room to finish instead of 504ing on a slow cold start. 60s (not 25)
// because a live probe showed these MovePro/Metabase endpoints run close to
// 15s per request from Vercel's network, and a truncated day needs a second
// (also parallel) round of per-agent requests on top of that.
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
