import { expect, test } from "vitest";

process.env.PGLITE_DIR = ":memory:";
const { getDb } = await import("../client");
const { ingestExtraServices } = await import("../ingest-extra-services");
const { extraServicesBoard } = await import("../queries/extra-services");
const { sydneyToday } = await import("../../lib/sydney");
const db = await getDb();

test("shows a zeroed Clara card before anything is pushed", async () => {
  expect(await extraServicesBoard()).toMatchObject({ name: "Clara", count: 0, month: 0, target: null, jobs: [] });
});

test("today's jobs + month total come through; blank job cells are dropped", async () => {
  await ingestExtraServices(db, {
    name: "Clara",
    jobs: [{ code: "87QE5K", forRep: "Nisreen" }, { code: "  ", forRep: "X" }, { code: "ABC123", forRep: null }],
    monthCount: 7,
    target: 8,
  });
  const b = await extraServicesBoard();
  expect(b).toMatchObject({ name: "Clara", count: 2, month: 7, target: 8 });
  expect(b.jobs[0]).toEqual({ code: "87QE5K", forRep: "Nisreen" });
});

test("a snapshot from yesterday resets today's count but keeps the month", async () => {
  const today = sydneyToday();
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  const yesterday = d.toISOString().slice(0, 10);
  if (yesterday.slice(0, 7) !== today.slice(0, 7)) return; // 1st of month: month rolls too, nothing to assert
  await ingestExtraServices(db, { jobs: [{ code: "OLD111", forRep: "A" }], monthCount: 5 }, yesterday);
  expect(await extraServicesBoard()).toMatchObject({ count: 0, month: 5 });
});
