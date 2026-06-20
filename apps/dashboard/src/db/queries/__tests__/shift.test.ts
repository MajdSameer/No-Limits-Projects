import { beforeAll, expect, test } from "vitest";

process.env.PGLITE_DIR = ":memory:";
const { getDb, schema } = await import("../../client");
const { dailyTeamGoal, shiftStates, shiftOverrideKey } = await import("../boards");
const { setSetting } = await import("../../settings");
const { sydneyToday } = await import("../../../lib/sydney");
const db = await getDb();

const NOW = new Date("2026-06-12T07:00:00Z"); // 2026-06-12 17:00 Sydney
const today = sydneyToday(NOW);
const KEY = shiftOverrideKey(NOW);

beforeAll(async () => {
  await db.insert(schema.staff).values([
    { id: "andy", name: "Andy", pinHash: "x", role: "rep" },
    { id: "hanna", name: "Hanna", pinHash: "x", role: "rep" },
    { id: "boss", name: "Boss", pinHash: "x", role: "manager" }, // never counts
  ]);
  await db.insert(schema.goals).values([
    { id: "g-andy", staffId: "andy", dailyTarget: 5, effectiveFrom: today },
    { id: "g-hanna", staffId: "hanna", dailyTarget: 3, effectiveFrom: today },
  ]);
  // Sheet: Andy clocked in (timeIn set), Hanna not.
  await db.insert(schema.repLive).values([
    { staffId: "andy", bookingsToday: 0, timeIn: "08:00", asOfDate: today },
    { staffId: "hanna", bookingsToday: 0, timeIn: null, asOfDate: today },
  ]);
});

test("with no override, on-shift follows the sheet's clock-in", async () => {
  await setSetting(KEY, ""); // no overrides
  const states = await shiftStates(NOW);
  const byId = Object.fromEntries(states.map((s) => [s.staffId, s]));
  expect(byId.andy?.onShift).toBe(true);
  expect(byId.andy?.overridden).toBe(false);
  expect(byId.hanna?.onShift).toBe(false);
  expect(states.some((s) => s.staffId === "boss")).toBe(false); // managers excluded

  const { target, active } = await dailyTeamGoal(NOW);
  expect(active).toBe(1); // only Andy
  expect(target).toBe(5); // Andy's goal
});

test("manager override On adds a rep the sheet shows as off", async () => {
  await setSetting(KEY, JSON.stringify({ hanna: true }));
  const states = await shiftStates(NOW);
  const hanna = states.find((s) => s.staffId === "hanna")!;
  expect(hanna.onShift).toBe(true);
  expect(hanna.overridden).toBe(true);
  expect(hanna.fromSheet).toBe(false);

  const { target, active } = await dailyTeamGoal(NOW);
  expect(active).toBe(2); // Andy (sheet) + Hanna (override)
  expect(target).toBe(8); // 5 + 3
});

test("manager override Off removes a rep the sheet shows as on", async () => {
  await setSetting(KEY, JSON.stringify({ andy: false, hanna: true }));
  const { target, active } = await dailyTeamGoal(NOW);
  expect(active).toBe(1); // Andy forced off, Hanna forced on
  expect(target).toBe(3); // Hanna's goal only
});
