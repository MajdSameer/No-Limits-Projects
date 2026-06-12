import { and, asc, eq, gte, lt } from "drizzle-orm";

import { getDb, schema } from "../client";
import { sydneyDayRange } from "../../lib/sydney";

/** A staff member's clock events for the current Sydney day, ordered. */
export async function todaysEvents(staffId: string) {
  const db = await getDb();
  const { start, end } = sydneyDayRange();
  return db
    .select()
    .from(schema.clockEvents)
    .where(
      and(
        eq(schema.clockEvents.staffId, staffId),
        gte(schema.clockEvents.at, start),
        lt(schema.clockEvents.at, end),
      ),
    )
    .orderBy(asc(schema.clockEvents.at));
}
