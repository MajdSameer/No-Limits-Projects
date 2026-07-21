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
        { code: "7QAB6", forRep: "Hadeel" }, // same code+rep again — still its own row, counts
        { code: "55BKK", forRep: "Jenifer" },
      ],
    },
    { name: "Danny", jobs: [] }, // no inspections today, but the box still shows
  ]);

  expect(res.inspectors).toBe(2);
  expect(res.jobs).toBe(3); // Martin's three job-numbered rows — a repeated code is still its own submission
  expect(res.asOfDate).toBe(today);

  const board = await inspectorBoard();
  // sorted by count desc: Martin (3) then Danny (0)
  expect(board.map((r) => r.id)).toEqual(["martin", "danny"]);
  const martin = board.find((r) => r.id === "martin")!;
  expect(martin.count).toBe(3);
  expect(martin.jobs).toEqual([
    { code: "7QAB6", forRep: "Hadeel" },
    { code: "7QAB6", forRep: "Hadeel" },
    { code: "55BKK", forRep: "Jenifer" },
  ]);
  // Danny's box persists with a zero count
  expect(board.find((r) => r.id === "danny")).toMatchObject({ name: "Danny", count: 0, jobs: [] });
});

test("stray non-job-number cell values are dropped, not counted", async () => {
  const today = sydneyToday();
  const res = await ingestInspectors(
    db,
    [
      {
        name: "Martin",
        jobs: [
          { code: "AY3VA", forRep: "Luka" }, // real (letters + digits)
          { code: "AY5YM", forRep: "Ann" }, // real
          { code: "3KZ3P", forRep: "francis" }, // real
          { code: "EDPAG", forRep: "Francis" }, // real — all letters, must still count
          { code: "Andy", forRep: "Luka" }, // a name in the job# cell — dropped (4 chars)
          { code: "1", forRep: "Anthony" }, // a loose number — dropped (1 char)
        ],
      },
    ],
    today,
  );

  expect(res.jobs).toBe(4); // the four real 5-char job codes count (incl. all-letter EDPAG)
  const board = await inspectorBoard();
  const martin = board.find((r) => r.id === "martin")!;
  expect(martin.count).toBe(4);
  expect(martin.jobs.map((j) => j.code)).toEqual(["AY3VA", "AY5YM", "3KZ3P", "EDPAG"]);
});

test("6-char job codes count too, and an email pasted into the cell is dropped", async () => {
  const today = sydneyToday();
  const res = await ingestInspectors(
    db,
    [
      {
        name: "Martin",
        jobs: [
          { code: "X8B96M", forRep: "Issac" }, // real — 6 chars
          { code: "VVZEXM", forRep: "Issac" }, // real — 6 chars, all letters
          { code: "leejaak@bigpond.net.au", forRep: "Issac" }, // stray email — dropped
        ],
      },
    ],
    today,
  );

  expect(res.jobs).toBe(2);
  const board = await inspectorBoard();
  const martin = board.find((r) => r.id === "martin")!;
  expect(martin.jobs.map((j) => j.code)).toEqual(["X8B96M", "VVZEXM"]);
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
    [{ name: "Danny", jobs: [{ code: "Z1B7K", forRep: "Randee" }] }],
    today,
  );
  const board = await inspectorBoard();
  // Danny now has one inspection; Martin's fixed box stays at 0 (sorted by count).
  expect(board.map((r) => r.id)).toEqual(["danny", "martin"]);
  expect(board.find((r) => r.id === "danny")).toMatchObject({
    count: 1,
    jobs: [{ code: "Z1B7K", forRep: "Randee" }],
  });
  expect(board.find((r) => r.id === "martin")).toMatchObject({ name: "Martin", count: 0, jobs: [] });
});

test("month total: pushed monthCount shows on the board, resets on a new month", async () => {
  const today = sydneyToday();
  await ingestInspectors(
    db,
    [
      { name: "Martin", jobs: [{ code: "J1X2M", forRep: "Ann" }], monthCount: 17 },
      { name: "Danny", jobs: [], monthCount: 9 },
    ],
    today,
  );
  let board = await inspectorBoard();
  // sorted by month desc → Martin (17) then Danny (9)
  expect(board.map((r) => r.id)).toEqual(["martin", "danny"]);
  expect(board.find((r) => r.id === "martin")).toMatchObject({ count: 1, month: 17 });
  expect(board.find((r) => r.id === "danny")).toMatchObject({ count: 0, month: 9 });

  // A snapshot from a previous month → today's count AND the month reset to 0.
  await ingestInspectors(
    db,
    [{ name: "Martin", jobs: [{ code: "OLD", forRep: "Ann" }], monthCount: 99 }],
    "2020-01-15",
  );
  board = await inspectorBoard();
  expect(board.find((r) => r.id === "martin")).toMatchObject({ count: 0, month: 0 });
});
