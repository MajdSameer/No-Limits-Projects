import { beforeAll, expect, test } from "vitest";

process.env.PGLITE_DIR = ":memory:";
const { getDb } = await import("../client");
const { ingestInspectors } = await import("../ingest-inspectors");
const { inspectorBoard } = await import("../queries/inspectors");
const { sydneyToday } = await import("../../lib/sydney");
const db = await getDb();

beforeAll(async () => {
  await getDb();
});

test("with nothing pushed, the wall still shows the two fixed boxes at 0", async () => {
  const board = await inspectorBoard();
  expect(board.map((r) => r.id)).toEqual(["danny", "martin"]); // both 0 → name order
  expect(board.every((r) => r.count === 0 && r.jobs.length === 0)).toBe(true);
});

test("ingest stores today's inspections per inspector, with job # + sales rep", async () => {
  const today = sydneyToday();
  const res = await ingestInspectors(db, [
    {
      name: "Martin",
      jobs: [
        { code: "7QAB6", forRep: "Hadeel" },
        { code: "", forRep: "Ann" }, // no job number — dropped
        { code: "7QAB6", forRep: "Hadeel" }, // duplicate — deduped
        { code: "55BKK", forRep: "Jenifer" },
      ],
    },
    { name: "Danny", jobs: [] }, // no inspections today, but the box still shows
  ]);

  expect(res.inspectors).toBe(2);
  expect(res.jobs).toBe(2); // Martin's two distinct, job-numbered inspections
  expect(res.asOfDate).toBe(today);

  const board = await inspectorBoard();
  // sorted by count desc: Martin (2) then Danny (0)
  expect(board.map((r) => r.id)).toEqual(["martin", "danny"]);
  const martin = board.find((r) => r.id === "martin")!;
  expect(martin.count).toBe(2);
  expect(martin.jobs).toEqual([
    { code: "7QAB6", forRep: "Hadeel" },
    { code: "55BKK", forRep: "Jenifer" },
  ]);
  // Danny's box persists with a zero count
  expect(board.find((r) => r.id === "danny")).toMatchObject({ name: "Danny", count: 0, jobs: [] });
});

test("a snapshot from an earlier day shows the boxes but resets the count to 0", async () => {
  await ingestInspectors(
    db,
    [{ name: "Martin", jobs: [{ code: "OLD11", forRep: "Hadeel" }] }],
    "2026-01-01", // an old day
  );
  const board = await inspectorBoard();
  const martin = board.find((r) => r.id === "martin")!;
  expect(martin.count).toBe(0);
  expect(martin.jobs).toEqual([]);
});

test("re-ingesting overwrites the snapshot; the fixed boxes always remain", async () => {
  const today = sydneyToday();
  await ingestInspectors(
    db,
    [{ name: "Danny", jobs: [{ code: "Z1", forRep: "Randee" }] }],
    today,
  );
  const board = await inspectorBoard();
  // Danny now has one inspection; Martin's fixed box stays at 0 (sorted by count).
  expect(board.map((r) => r.id)).toEqual(["danny", "martin"]);
  expect(board.find((r) => r.id === "danny")).toMatchObject({
    count: 1,
    jobs: [{ code: "Z1", forRep: "Randee" }],
  });
  expect(board.find((r) => r.id === "martin")).toMatchObject({ name: "Martin", count: 0, jobs: [] });
});
