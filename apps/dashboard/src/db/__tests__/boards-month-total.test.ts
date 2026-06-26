import { expect, test } from "vitest";

process.env.PGLITE_DIR = ":memory:";
const { getDb, schema } = await import("../client");
const { ingestMonthly } = await import("../ingest-monthly");
const { monthlyBoard, sheetMonthGrandTotal } = await import("../queries/boards");
const { sydneyToday } = await import("../../lib/sydney");
const db = await getDb();

test("headline month total counts everyone the sheet pushed; the board lists only active reps", async () => {
  // Two active reps, one manager (Max). Jessica isn't in the staff table at all.
  await db.insert(schema.staff).values([
    { id: "francis", name: "Francis", role: "rep", pinHash: "x" },
    { id: "hanna", name: "Hanna", role: "rep", pinHash: "x" },
    { id: "max", name: "Max", role: "manager", pinHash: "x" },
  ]);

  // The sheet tallies all four for the current month.
  const month = sydneyToday().slice(0, 7);
  await ingestMonthly(db, month, { Francis: 100, Hanna: 46, Max: 65, Jessica: 32 });

  // The per-rep leaderboard shows only active reps — Max (manager) and Jessica
  // (not in staff) are excluded, so the board sums to less than the headline.
  const board = await monthlyBoard();
  expect(board.map((r) => r.staffId).sort()).toEqual(["francis", "hanna"]);
  expect(board.reduce((s, r) => s + r.count, 0)).toBe(146); // 100 + 46

  // The headline grand total includes Max (65) and Jessica (32): 100+46+65+32.
  expect(await sheetMonthGrandTotal()).toBe(243);
});
