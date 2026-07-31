import { NextResponse } from "next/server";

import { getUnseenSnapshot } from "../../../lib/movepro-unseen";

export const dynamic = "force-dynamic";
// A single ~2s query with generous headroom — nowhere near the monthly
// cold-start cost /api/actions has to budget for.
export const maxDuration = 25;

/**
 * Public by design, like /api/actions — the wall TV has no session. Serves
 * the "unseen communications" board (view 2 of the /actions rotation) from a
 * short in-memory cache (see movepro-unseen) so polling tabs don't each
 * trigger a fresh query.
 */
export async function GET() {
  try {
    const data = await getUnseenSnapshot();
    return NextResponse.json(data, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    console.error("GET /api/unseen failed:", err);
    const detail = err instanceof Error ? err.message.slice(0, 300) : String(err).slice(0, 300);
    return NextResponse.json({ error: "Failed to load unseen communications data", detail }, { status: 502 });
  }
}
