import { beforeAll, expect, test } from "vitest";

process.env.PGLITE_DIR = ":memory:";
const { getDb, schema } = await import("../../client");
const db = await getDb();
const { autoCloseOpenDays, dayStates } = await import("../timesheet");
const { sydneyDayRange } = await import("../../../lib/sydney");

// Fixed test day: Friday 2026-06-12 in Sydney (AEST).
const NOW = new Date("2026-06-12T07:00:00Z"); // 17:00 Sydney
const range = sydneyDayRange(NOW);
const at = (hhmm: string) => new Date(`2026-06-12T${hhmm}:00+10:00`);

beforeAll(async () => {
  await db.insert(schema.staff).values([
    { id: "done", name: "Donna", pinHash: "x" },
    { id: "open", name: "Open", pinHash: "x" },
    { id: "late", name: "Larry", pinHash: "x" },
  ]);
  // Friday = weekday 4 (0=Mon). Larry rostered 08:00 start.
  await db.insert(schema.shifts).values({ id: "sh1", staffId: "late", weekday: 4, start: "08:00", end: "17:00" });
  await db.insert(schema.clockEvents).values([
    { id: "e1", staffId: "done", kind: "in", at: at("08:00") },
    { id: "e2", staffId: "done", kind: "out", at: at("16:00") },
    { id: "e3", staffId: "open", kind: "in", at: at("09:00") },
    { id: "e4", staffId: "late", kind: "in", at: at("08:25") },
    { id: "e5", staffId: "late", kind: "out", at: at("15:00") },
  ]);
});

test("dayStates derives per-staff status, hours and lateness", async () => {
  const states = await dayStates(range, NOW);
  const donna = states.find((s) => s.staffId === "done")!;
  expect(donna.status).toBe("done");
  expect(donna.workedMs).toBe(8 * 36e5);
  expect(donna.lateMins).toBeNull();

  const open = states.find((s) => s.staffId === "open")!;
  expect(open.status).toBe("on");

  const larry = states.find((s) => s.staffId === "late")!;
  expect(larry.lateMins).toBe(25);
});

test("autoCloseOpenDays closes only open days, idempotently", async () => {
  expect(await autoCloseOpenDays(range)).toBe(1); // only "open"
  expect(await autoCloseOpenDays(range)).toBe(0); // second run no-op

  const states = await dayStates(range, NOW);
  const open = states.find((s) => s.staffId === "open")!;
  expect(open.status).toBe("done");
  expect(open.autoClosed).toBe(true);
});
