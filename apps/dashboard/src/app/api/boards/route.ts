import { NextResponse } from "next/server";

import { getBoardsSnapshot } from "../../../db/queries/boards-snapshot";

export const dynamic = "force-dynamic";
// Fail fast rather than hang the wall display if the DB is ever unreachable.
export const maxDuration = 20;

/**
 * Public by design (the wall TV has no session): first names, counts, goals,
 * gender/team tint, monthly progress and live allocation shares ONLY — never
 * customer or money data. Served from a short cache so many polling tabs don't
 * stampede the DB (see boards-snapshot).
 */
export async function GET() {
  const data = await getBoardsSnapshot();
  return NextResponse.json(data, { headers: { "cache-control": "no-store" } });
}
