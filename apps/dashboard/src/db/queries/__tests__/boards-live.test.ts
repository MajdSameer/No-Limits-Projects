import { beforeAll, expect, test } from "vitest";

process.env.PGLITE_DIR = ":memory:";
const { getDb, schema } = await import("../../client");
const { dailyBoard } = await import("../boards");
const { sydneyToday } = await import("../../../lib/sydney");
const db = await getDb();

const NOW = new Date("2026-06-12T07:00:00Z"); // 2026-06-12 17:00 Sydney
const today = sydneyToday(NOW);

beforeAll(async () => {
  await db.insert(schema.staff).values([
    { id: "andy", name: "Andy", pinHash: "x" },
    { id: "hanna", name: "Hanna", pinHash: "x" },
  ]);
  await db.insert(schema.repLive).values([
    { staffId: "andy", bookingsToday: 5, asOfDate: today },
    { staffId: "hanna", bookingsToday: 2, asOfDate: today },
  ]);
});

test("dailyBoard uses the live sheet count when rep_live has today's snapshot", async () => {
  // No bookings inserted — the app count is 0, so any counts come from rep_live.
  const board = await dailyBoard(NOW);
  const counts = Object.fromEntries(board.map((r) => [r.staffId, r.count]));
  expect(counts).toEqual({ andy: 5, hanna: 2 });
  expect(board[0]?.staffId).toBe("andy"); // sorted by count desc
});

test("a stale (not-today) rep_live snapshot is ignored", async () => {
  await db.update(schema.repLive).set({ asOfDate: "2026-06-11" }); // mark all stale
  const board = await dailyBoard(NOW);
  // Falls back to app bookings (none) → all zero.
  expect(board.every((r) => r.count === 0)).toBe(true);
});
