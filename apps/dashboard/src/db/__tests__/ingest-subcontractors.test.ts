import { beforeAll, expect, test } from "vitest";

process.env.PGLITE_DIR = ":memory:";
const { getDb } = await import("../client");
const { ingestSubcontractors } = await import("../ingest-subcontractors");
const { subcontractorBoard, SUBCONTRACTOR_DAILY_TARGET } = await import("../queries/subcontractors");
const { sydneyToday } = await import("../../lib/sydney");
const db = await getDb();

beforeAll(async () => {
  await getDb();
});

test("with nothing pushed, the wall still shows the fixed box at 0 / target", async () => {
  const board = await subcontractorBoard();
  expect(board.map((r) => r.id)).toEqual(["domanic"]);
  expect(board[0]).toMatchObject({ count: 0, month: 0, target: SUBCONTRACTOR_DAILY_TARGET });
});

test("ingest stores today's count + month total, jobs deduped", async () => {
  const today = sydneyToday();
  const res = await ingestSubcontractors(
    db,
    [{ name: "Domanic", count: 6, monthCount: 128, jobs: ["313", "313", "movera", "", "madi ck"] }],
    today,
  );
  expect(res.subcontractors).toBe(1);
  expect(res.asOfDate).toBe(today);

  const board = await subcontractorBoard();
  expect(board[0]).toMatchObject({ id: "domanic", count: 6, month: 128, target: 12 });
  expect(board[0]!.jobs).toEqual(["313", "movera", "madi ck"]); // deduped, blanks dropped
});

test("a snapshot from an earlier day shows the box but resets today's count to 0", async () => {
  await ingestSubcontractors(db, [{ name: "Domanic", count: 9, monthCount: 130 }], "2026-01-01");
  const board = await subcontractorBoard();
  // old DAY but — being January — also an old month, so both reset
  expect(board[0]).toMatchObject({ count: 0, month: 0 });
});

test("month total persists across the month but resets on a new month", async () => {
  const today = sydneyToday();
  await ingestSubcontractors(db, [{ name: "Domanic", count: 4, monthCount: 140 }], today);
  let board = await subcontractorBoard();
  expect(board[0]).toMatchObject({ count: 4, month: 140 });

  // A snapshot from a previous month → today's count AND the month reset to 0.
  await ingestSubcontractors(db, [{ name: "Domanic", count: 7, monthCount: 99 }], "2020-01-15");
  board = await subcontractorBoard();
  expect(board[0]).toMatchObject({ count: 0, month: 0 });
});
