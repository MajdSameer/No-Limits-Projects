import { NextResponse } from "next/server";

import { getActionsSnapshot } from "../../../lib/movepro-actions";

export const dynamic = "force-dynamic";
// A cold instance's monthly assembly is ~30 external requests, parallelized;
// give it room to finish instead of 504ing on a slow cold start.
export const maxDuration = 25;

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
    return NextResponse.json({ error: "Failed to load activity data" }, { status: 502 });
  }
}
