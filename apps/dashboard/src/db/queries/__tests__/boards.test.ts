import { beforeAll, expect, test } from "vitest";

process.env.PGLITE_DIR = ":memory:";
const { getDb, schema } = await import("../../client");
const db = await getDb();
const { dailyBoard, monthlyBoard, pipelineBoard, yesterdayBoard } = await import("../boards");

// Fixed "now": 2026-06-12 17:00 Sydney.
const NOW = new Date("2026-06-12T07:00:00Z");
const t = (iso: string) => new Date(iso);

let n = 0;
function booking(rep: string, enteredAt: Date, moveDate: string, deleted = false) {
  n += 1;
  return {
    id: `b${n}`,
    jobNumber: `JOB${String(n).padStart(3, "0")}`,
    moveDate,
    salesRepId: rep,
    createdBy: rep,
    enteredAt,
    deletedAt: deleted ? enteredAt : null,
  };
}

beforeAll(async () => {
  await db.insert(schema.staff).values([
    { id: "andy", name: "Andy", pinHash: "x" },
    { id: "hanna", name: "Hanna", pinHash: "x" },
    { id: "manager", name: "Manager", role: "manager", pinHash: "x" },
    { id: "ghost", name: "Ghost", pinHash: "x", active: false },
  ]);
  await db.insert(schema.goals).values([
    { id: "g1", staffId: "andy", dailyTarget: 3, effectiveFrom: "2026-01-01" },
    { id: "g2", staffId: "andy", dailyTarget: 7, effectiveFrom: "2026-06-01" }, // later wins
    { id: "g3", staffId: "hanna", dailyTarget: 5, effectiveFrom: "2026-01-01" },
    { id: "g4", staffId: "hanna", dailyTarget: 9, effectiveFrom: "2026-07-01" }, // future — ignored
  ]);
  await db.insert(schema.bookings).values([
    // Today (Sydney 2026-06-12): two for Andy, one for Hanna, one deleted.
    booking("andy", t("2026-06-12T00:30:00Z"), "2026-06-20"),
    booking("andy", t("2026-06-11T22:00:00Z"), "2026-07-15"), // 08:00 Sydney 12th
    booking("hanna", t("2026-06-12T05:00:00Z"), "2026-10-01"), // move date beyond 3mo
    booking("andy", t("2026-06-12T06:00:00Z"), "2026-06-25", true), // deleted
    // Yesterday (11th Sydney).
    booking("hanna", t("2026-06-11T01:00:00Z"), "2026-06-18"),
    // Earlier this month.
    booking("hanna", t("2026-06-02T01:00:00Z"), "2026-06-13"),
    // Last month (out of all entered windows; move date inside pipeline).
    booking("andy", t("2026-05-20T01:00:00Z"), "2026-08-01"),
    // Manager booking — managers don't appear on boards.
    booking("manager", t("2026-06-12T02:00:00Z"), "2026-06-30"),
  ]);
});

test("daily: Sydney window, deleted excluded, goals = latest effective", async () => {
  const rows = await dailyBoard(NOW);
  expect(rows.map((r) => [r.staffId, r.count, r.goal])).toEqual([
    ["andy", 2, 7],
    ["hanna", 1, 5],
  ]);
});

test("yesterday window", async () => {
  const rows = await yesterdayBoard(NOW);
  expect(rows.find((r) => r.staffId === "hanna")?.count).toBe(1);
  expect(rows.find((r) => r.staffId === "andy")?.count).toBe(0);
});

test("daily boxes carry no money fields (revenue lives on the monthly board)", async () => {
  const { setSetting } = await import("../../settings");
  const { monthRevenueKey } = await import("../../ingest-monthly");
  await setSetting(monthRevenueKey("2026-06"), JSON.stringify({ andy: 50000 }));
  const rows = await dailyBoard(NOW);
  expect(rows.find((r) => r.staffId === "andy")?.revenue).toBeUndefined();
  await setSetting(monthRevenueKey("2026-06"), "");
});

test("monthly falls back to app bookings entered this month when no sheet push", async () => {
  const rows = await monthlyBoard(NOW);
  expect(rows.find((r) => r.staffId === "hanna")?.count).toBe(3);
  expect(rows.find((r) => r.staffId === "andy")?.count).toBe(2);
});

test("monthly uses the sheet tally (raw row count) once the Booking tab pushes", async () => {
  const { setSetting } = await import("../../settings");
  const { monthSettingKey } = await import("../../ingest-monthly");
  // 2026-06 sheet tally — higher than the app's deduped count, as on the floor.
  await setSetting(monthSettingKey("2026-06"), JSON.stringify({ hanna: 46, andy: 58 }));
  const rows = await monthlyBoard(NOW);
  expect(rows.find((r) => r.staffId === "hanna")?.count).toBe(46);
  expect(rows.find((r) => r.staffId === "andy")?.count).toBe(58);
  // Clean up so other tests in this file see the fallback again.
  await setSetting(monthSettingKey("2026-06"), "");
});

test("monthly attaches the sheet's net revenue per rep", async () => {
  const { setSetting } = await import("../../settings");
  const { monthSettingKey, monthRevenueKey } = await import("../../ingest-monthly");
  await setSetting(monthSettingKey("2026-06"), JSON.stringify({ andy: 158, hanna: 80 }));
  await setSetting(monthRevenueKey("2026-06"), JSON.stringify({ andy: 100000, hanna: 50000 }));
  const rows = await monthlyBoard(NOW);
  expect(rows.find((r) => r.staffId === "andy")?.revenue).toBe(100000);
  expect(rows.find((r) => r.staffId === "hanna")?.revenue).toBe(50000);
  await setSetting(monthSettingKey("2026-06"), "");
  await setSetting(monthRevenueKey("2026-06"), "");
});

test("monthly drops an impossible negative/garbage revenue instead of showing it", async () => {
  const { setSetting } = await import("../../settings");
  const { monthSettingKey, monthRevenueKey } = await import("../../ingest-monthly");
  await setSetting(monthSettingKey("2026-06"), JSON.stringify({ andy: 158, hanna: 80 }));
  // andy gets a real figure; hanna a garbage negative (e.g. the Booking script
  // drifting onto a text column). The board keeps andy and omits hanna's money
  // line rather than splashing a -$134k figure on the wall.
  await setSetting(
    monthRevenueKey("2026-06"),
    JSON.stringify({ andy: 100000, hanna: -134740.1975 }),
  );
  const rows = await monthlyBoard(NOW);
  expect(rows.find((r) => r.staffId === "andy")?.revenue).toBe(100000);
  expect(rows.find((r) => r.staffId === "hanna")?.revenue).toBeUndefined();
  await setSetting(monthSettingKey("2026-06"), "");
  await setSetting(monthRevenueKey("2026-06"), "");
});

test("monthly omits revenue when the sheet hasn't pushed it", async () => {
  const rows = await monthlyBoard(NOW);
  expect(rows.find((r) => r.staffId === "andy")?.revenue).toBeUndefined();
});

test("pipeline (fallback) counts move dates from the 1st of the month, 3 months out", async () => {
  const rows = await pipelineBoard(NOW); // NOW = 2026-06-12 → window [2026-06-01, 2026-09-01)
  // andy: 06-20, 07-15, 08-01 (deleted 06-25 excluded) = 3
  expect(rows.find((r) => r.staffId === "andy")?.count).toBe(3);
  // hanna: 06-18, 06-13 in window; 10-01 outside = 2
  expect(rows.find((r) => r.staffId === "hanna")?.count).toBe(2);
});

test("pipeline uses the sheet tally (raw row count) once the Booking tab pushes", async () => {
  const { setSetting } = await import("../../settings");
  const { PIPELINE_KEY } = await import("../../ingest-monthly");
  await setSetting(PIPELINE_KEY, JSON.stringify({ andy: 40, hanna: 25 }));
  const rows = await pipelineBoard(NOW);
  expect(rows.find((r) => r.staffId === "andy")?.count).toBe(40);
  expect(rows.find((r) => r.staffId === "hanna")?.count).toBe(25);
  await setSetting(PIPELINE_KEY, ""); // clean up for other tests
});

test("inactive staff and managers never appear", async () => {
  const rows = await dailyBoard(NOW);
  expect(rows.some((r) => r.staffId === "ghost" || r.staffId === "manager")).toBe(false);
});
