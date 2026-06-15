import { eq } from "drizzle-orm";
import { beforeAll, expect, test } from "vitest";

process.env.PGLITE_DIR = ":memory:";
const { getDb, schema } = await import("../client");
const { ingestRoster } = await import("../ingest-roster");
const db = await getDb();

beforeAll(async () => {
  await db.insert(schema.staff).values({ id: "andy", name: "Andy", pinHash: "x" });
});

test("roster ingest writes shifts, creates new reps, and is change-aware", async () => {
  const res = await ingestRoster(db, [
    { name: "Andy", weekdays: [0, 1, 2, 3, 5] }, // Mon–Thu + Sat
    { name: "Nisreen", weekdays: [0, 1, 3] }, // new rep
    { name: "  ", weekdays: [0] }, // ignored
  ]);

  expect(res.total).toBe(2);
  expect(res.added).toContain("nisreen");
  expect(res.rosterChanged.sort()).toEqual(["andy", "nisreen"]);

  const andyShifts = await db
    .select({ weekday: schema.shifts.weekday, start: schema.shifts.start, end: schema.shifts.end })
    .from(schema.shifts)
    .where(eq(schema.shifts.staffId, "andy"));
  expect(andyShifts.map((s) => s.weekday).sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 5]);
  expect(andyShifts[0]?.start.slice(0, 5)).toBe("08:00");
  expect(andyShifts[0]?.end.slice(0, 5)).toBe("17:00");

  // re-pushing the SAME grid changes nothing (no churn)
  const again = await ingestRoster(db, [{ name: "Andy", weekdays: [3, 2, 1, 0, 5] }]);
  expect(again.rosterChanged).toEqual([]);

  // a changed day-set rewrites
  const changed = await ingestRoster(db, [{ name: "Andy", weekdays: [0, 1] }]);
  expect(changed.rosterChanged).toEqual(["andy"]);
  const after = await db
    .select({ weekday: schema.shifts.weekday })
    .from(schema.shifts)
    .where(eq(schema.shifts.staffId, "andy"));
  expect(after.map((s) => s.weekday).sort((a, b) => a - b)).toEqual([0, 1]);
});
