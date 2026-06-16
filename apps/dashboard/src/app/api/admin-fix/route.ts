import { and, asc, eq, lte } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";

import { getDb, schema } from "../../../db/client";
import { newId } from "../../../lib/id";
import { sydneyToday } from "../../../lib/sydney";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * TEMP one-off admin: secret-guarded roster tweaks the sheet push can't make
 * (deactivate a stale rep, set a daily goal for a rep not in the sheet roster).
 *   ?key=<INGEST_SECRET>&list=1                  -> inspect staff + current goals
 *   ?key=...&deactivate=martin&setgoal3=luka,anthony
 * To be removed once applied.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.INGEST_SECRET;
  const sp = request.nextUrl.searchParams;
  if (!secret || sp.get("key") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const db = await getDb();
  const today = sydneyToday();

  const ids = (k: string) =>
    (sp.get(k) ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

  const deactivated: string[] = [];
  for (const id of ids("deactivate")) {
    const [s] = await db
      .select({ id: schema.staff.id })
      .from(schema.staff)
      .where(eq(schema.staff.id, id))
      .limit(1);
    if (!s) continue;
    await db.update(schema.staff).set({ active: false }).where(eq(schema.staff.id, id));
    deactivated.push(id);
  }

  const goalsSet: string[] = [];
  for (const id of ids("setgoal3")) {
    const [staff] = await db
      .select({ id: schema.staff.id })
      .from(schema.staff)
      .where(eq(schema.staff.id, id))
      .limit(1);
    if (!staff) continue;
    const [g] = await db
      .select({ id: schema.goals.id })
      .from(schema.goals)
      .where(and(eq(schema.goals.staffId, id), eq(schema.goals.effectiveFrom, today)))
      .limit(1);
    if (g) {
      await db.update(schema.goals).set({ dailyTarget: 3 }).where(eq(schema.goals.id, g.id));
    } else {
      await db
        .insert(schema.goals)
        .values({ id: newId(), staffId: id, dailyTarget: 3, effectiveFrom: today });
    }
    goalsSet.push(id);
  }

  const staff = await db
    .select({
      id: schema.staff.id,
      name: schema.staff.name,
      role: schema.staff.role,
      active: schema.staff.active,
    })
    .from(schema.staff)
    .orderBy(asc(schema.staff.name));

  const goalRows = await db
    .select({ staffId: schema.goals.staffId, target: schema.goals.dailyTarget, from: schema.goals.effectiveFrom })
    .from(schema.goals)
    .where(lte(schema.goals.effectiveFrom, today))
    .orderBy(asc(schema.goals.effectiveFrom));
  const goalFor = new Map<string, number>();
  for (const g of goalRows) goalFor.set(g.staffId, g.target); // later wins

  return NextResponse.json({
    applied: { deactivated, goalsSet },
    staff: staff.map((s) => ({ ...s, goal: goalFor.get(s.id) ?? null })),
  });
}
