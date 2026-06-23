import { NextResponse } from "next/server";

import { getBoardsSnapshot } from "../../../db/queries/boards-snapshot";

export const dynamic = "force-dynamic";
// The free-tier DB is slow + variable on cold instances; give the (cached,
// sequential) compute room to finish instead of 504ing at 20s. Still a ceiling
// so a truly unreachable DB doesn't hang forever.
export const maxDuration = 25;

/**
 * Public by design (the wall TV has no session): first names, counts, goals,
 * gender/team tint, monthly progress, live allocation shares, and each rep's
 * monthly NET revenue + estimated commission (shown on /live by request) — never
 * customer data. Served from a short cache so many polling tabs don't stampede
 * the DB (see boards-snapshot).
 */
export async function GET() {
  const data = await getBoardsSnapshot();
  return NextResponse.json(data, { headers: { "cache-control": "no-store" } });
}
