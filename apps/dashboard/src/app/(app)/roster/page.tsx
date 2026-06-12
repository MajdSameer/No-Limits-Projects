import { asc, eq, gte } from "drizzle-orm";

import { getDb, schema } from "../../../db/client";
import { dayStates } from "../../../db/queries/timesheet";
import { requireSession } from "../../../lib/session";
import { sydneyDayRange, sydneyToday } from "../../../lib/sydney";
import { RosterView } from "../../../components/RosterView";

export const metadata = { title: "Roster" };
export const dynamic = "force-dynamic";

export default async function RosterPage() {
  const session = await requireSession();
  const db = await getDb();

  const [staffRows, shiftRows, timeOffRows, states] = await Promise.all([
    db
      .select({ id: schema.staff.id, name: schema.staff.name })
      .from(schema.staff)
      .where(eq(schema.staff.active, true))
      .orderBy(asc(schema.staff.name)),
    db.select().from(schema.shifts),
    db
      .select()
      .from(schema.timeOff)
      .where(gte(schema.timeOff.toDate, sydneyToday()))
      .orderBy(asc(schema.timeOff.fromDate)),
    dayStates(sydneyDayRange()),
  ]);

  return (
    <RosterView
      isManager={session.role === "manager"}
      staff={staffRows}
      shifts={shiftRows.map((s) => ({
        staffId: s.staffId,
        weekday: s.weekday,
        start: s.start.slice(0, 5),
        end: s.end.slice(0, 5),
      }))}
      timeOff={timeOffRows.map((t) => ({
        id: t.id,
        staffId: t.staffId,
        fromDate: t.fromDate,
        toDate: t.toDate,
        reason: t.reason,
      }))}
      today={states.map((s) => ({
        staffId: s.staffId,
        name: s.name,
        status: s.status,
        workedMs: s.workedMs,
        breakMs: s.breakMs,
        autoClosed: s.autoClosed,
        lateMins: s.lateMins,
      }))}
    />
  );
}
