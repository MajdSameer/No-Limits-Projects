import { redirect } from "next/navigation";
import { asc, desc, lte } from "drizzle-orm";

import { getDb, schema } from "../../../db/client";
import { shiftStates } from "../../../db/queries/boards";
import { getMonthlyGoal } from "../../../db/settings";
import { getSession } from "../../../lib/session";
import { sydneyToday } from "../../../lib/sydney";
import { ManageView } from "../../../components/ManageView";

export const metadata = { title: "Manage" };
export const dynamic = "force-dynamic";

export default async function ManagePage() {
  const session = await getSession();
  if (!session || session.role !== "manager") redirect("/");

  const db = await getDb();
  const [staffRows, goalRows, auditRows, monthlyGoal, shifts] = await Promise.all([
    db.select().from(schema.staff).orderBy(asc(schema.staff.name)),
    db
      .select()
      .from(schema.goals)
      .where(lte(schema.goals.effectiveFrom, sydneyToday()))
      .orderBy(asc(schema.goals.effectiveFrom)),
    db.select().from(schema.auditLog).orderBy(desc(schema.auditLog.at)).limit(100),
    getMonthlyGoal(),
    shiftStates(),
  ]);

  const goalMap = new Map<string, number>();
  for (const g of goalRows) goalMap.set(g.staffId, g.dailyTarget);

  return (
    <ManageView
      monthlyGoal={monthlyGoal}
      shifts={shifts}
      staff={staffRows.map((s) => ({
        id: s.id,
        name: s.name,
        role: s.role,
        active: s.active,
        locked: Boolean(s.lockedAt),
        intakeWeight: Number(s.intakeWeight),
        goal: goalMap.get(s.id) ?? null,
        gender: s.gender,
        team: s.team,
      }))}
      audit={auditRows.map((a) => ({
        id: a.id,
        staffId: a.staffId,
        action: a.action,
        entity: a.entity,
        entityId: a.entityId,
        atISO: a.at.toISOString(),
      }))}
    />
  );
}
