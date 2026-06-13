import { NextResponse } from "next/server";

import { allocationView } from "../../../db/queries/allocation";
import { getSession } from "../../../lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const view = await allocationView();
  return NextResponse.json(view, { headers: { "cache-control": "no-store" } });
}
