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

test("with nothing pushed, the wall still shows the fixed box at 0", async () => {
  const board = await inspectorBoard();
  expect(board.map((r) => r.id)).toEqual(["danny"]);
  expect(board.every((r) => r.count === 0 && r.jobs.length === 0)).toBe(true);
});

test("ingest stores today's inspections per inspector, with job # + sales rep", async () => {
  const today = sydneyToday();
  const res = await ingestInspectors(db, [
    {
      name: "Alex",
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
  expect(res.jobs).toBe(3); // Alex's three job-numbered rows — a repeated code is still its own submission
  expect(res.asOfDate).toBe(today);

  const board = await inspectorBoard();
  // sorted by count desc: Alex (3) then Danny (0)
  expect(board.map((r) => r.id)).toEqual(["alex", "danny"]);
  const alex = board.find((r) => r.id === "alex")!;
  expect(alex.count).toBe(3);
  expect(alex.jobs).toEqual([
    { code: "7QAB6", forRep: "Hadeel" },
    { code: "7QAB6", forRep: "Hadeel" },
    { code: "55BKK", forRep: "Jenifer" },
  ]);
  // Danny's box persists with a zero count
  expect(board.find((r) => r.id === "danny")).toMatchObject({ name: "Danny", count: 0, jobs: [] });
});

test("job code format is never validated — only a truly blank cell is dropped", async () => {
  const today = sydneyToday();
  const res = await ingestInspectors(
    db,
    [
      {
        name: "Alex",
        jobs: [
          { code: "AY3VA", forRep: "Luka" }, // a normal 5-char code
          { code: "X8B96M", forRep: "Issac" }, // a 6-char code
          { code: "EDPAG", forRep: "Francis" }, // all letters
          { code: "Andy", forRep: "Luka" }, // a name typed into the job# cell — still counts
          { code: "1", forRep: "Anthony" }, // a loose number — still counts
          { code: "leejaak@bigpond.net.au", forRep: "Issac" }, // an email typo'd into the cell — still counts
          { code: "", forRep: "Ann" }, // truly blank — the only thing dropped
        ],
      },
    ],
    today,
  );

  // Every non-blank cell counts, whatever it looks like — the sheet's own
  // reference count doesn't validate format either, so neither do we.
  expect(res.jobs).toBe(6);
  const board = await inspectorBoard();
  const alex = board.find((r) => r.id === "alex")!;
  expect(alex.count).toBe(6);
  expect(alex.jobs.map((j) => j.code)).toEqual([
    "AY3VA",
    "X8B96M",
    "EDPAG",
    "Andy",
    "1",
    "leejaak@bigpond.net.au",
  ]);
});

test("a snapshot from an earlier day shows the box but resets the count to 0", async () => {
  await ingestInspectors(
    db,
    [{ name: "Alex", jobs: [{ code: "OLD11", forRep: "Hadeel" }] }],
    "2026-01-01", // an old day
  );
  const board = await inspectorBoard();
  const alex = board.find((r) => r.id === "alex")!;
  expect(alex.count).toBe(0);
  expect(alex.jobs).toEqual([]);
});

test("re-ingesting overwrites the snapshot; the fixed box always remains", async () => {
  const today = sydneyToday();
  await ingestInspectors(db, [{ name: "Alex", jobs: [{ code: "Z1B7K", forRep: "Randee" }] }], today);
  const board = await inspectorBoard();
  // Alex now has one inspection; Danny's fixed box stays at 0 (sorted by count)
  // even though this push didn't mention him at all.
  expect(board.map((r) => r.id)).toEqual(["alex", "danny"]);
  expect(board.find((r) => r.id === "alex")).toMatchObject({
    count: 1,
    jobs: [{ code: "Z1B7K", forRep: "Randee" }],
  });
  expect(board.find((r) => r.id === "danny")).toMatchObject({ name: "Danny", count: 0, jobs: [] });
});

test("month total: pushed monthCount shows on the board, resets on a new month", async () => {
  const today = sydneyToday();
  await ingestInspectors(
    db,
    [
      { name: "Alex", jobs: [{ code: "J1X2M", forRep: "Ann" }], monthCount: 17 },
      { name: "Danny", jobs: [], monthCount: 9 },
    ],
    today,
  );
  let board = await inspectorBoard();
  // sorted by month desc → Alex (17) then Danny (9)
  expect(board.map((r) => r.id)).toEqual(["alex", "danny"]);
  expect(board.find((r) => r.id === "alex")).toMatchObject({ count: 1, month: 17 });
  expect(board.find((r) => r.id === "danny")).toMatchObject({ count: 0, month: 9 });

  // A snapshot from a previous month → today's count AND the month reset to 0.
  await ingestInspectors(db, [{ name: "Alex", jobs: [{ code: "OLD", forRep: "Ann" }], monthCount: 99 }], "2020-01-15");
  board = await inspectorBoard();
  expect(board.find((r) => r.id === "alex")).toMatchObject({ count: 0, month: 0 });
});

test("a pushed row for Martin is stored by ingest but never shown on the board", async () => {
  const today = sydneyToday();
  const res = await ingestInspectors(
    db,
    [{ name: "Martin", jobs: [{ code: "M1X2M", forRep: "Ann" }], monthCount: 5 }],
    today,
  );
  // The ingest layer doesn't know about hiding — it stores whatever the sheet
  // sends (so nothing is lost if the hide is ever reverted).
  expect(res.inspectors).toBe(1);
  expect(res.jobs).toBe(1);

  // The board (display layer) filters him out entirely — no zero-count box,
  // no trace at all — regardless of the sheet still pushing his row.
  const board = await inspectorBoard();
  expect(board.find((r) => r.id === "martin")).toBeUndefined();
});
