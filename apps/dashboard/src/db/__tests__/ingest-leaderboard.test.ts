import { eq } from "drizzle-orm";
import { beforeAll, expect, test } from "vitest";

process.env.PGLITE_DIR = ":memory:";
const { getDb, schema } = await import("../client");
const { ingestLeaderboard } = await import("../ingest-leaderboard");
const { liveLeaderboard } = await import("../queries/live");
const { sydneyToday } = await import("../../lib/sydney");
const db = await getDb();

beforeAll(async () => {
  // One existing rep with an outdated weight; the push should correct it.
  await db.insert(schema.staff).values({
    id: "andy",
    name: "Andy",
    pinHash: "x",
    intakeWeight: "0.9",
  });
});

test("ingest upserts roster + goal + live snapshot, and feeds the board", async () => {
  const today = sydneyToday();
  const res = await ingestLeaderboard(db, [
    {
      name: "Andy",
      intakeWeight: 1.1,
      dailyTarget: 7,
      bookingsToday: 5,
      jobCodes: ["P9GGQ", "B89VY", ""], // blank is dropped
      timeIn: "08:00",
      timeOut: "",
    },
    { name: "Nisreen", intakeWeight: 1.1, dailyTarget: 8, bookingsToday: 2 }, // brand new rep
    { name: "  " }, // ignored
  ]);

  expect(res.total).toBe(2);
  expect(res.added).toContain("nisreen");
  expect(res.rosterUpdated).toContain("andy"); // weight 0.9 -> 1.1

  // staff weight corrected, new rep created with a PIN
  const [andy] = await db
    .select({ w: schema.staff.intakeWeight })
    .from(schema.staff)
    .where(eq(schema.staff.id, "andy"));
  expect(Number(andy?.w)).toBe(1.1);

  // live snapshot stored, job codes cleaned
  const [live] = await db
    .select()
    .from(schema.repLive)
    .where(eq(schema.repLive.staffId, "andy"));
  expect(live?.bookingsToday).toBe(5);
  expect(live?.jobCodes).toEqual(["P9GGQ", "B89VY"]);
  expect(live?.asOfDate).toBe(today);

  // board reads it, sorted by count desc, with goal + on-shift
  const board = await liveLeaderboard();
  expect(board.map((r) => r.staffId)).toEqual(["andy", "nisreen"]);
  expect(board[0]?.bookingsToday).toBe(5);
  expect(board[0]?.goal).toBe(7);
  expect(board[0]?.onShift).toBe(true); // timeIn set, no timeOut

  // re-ingesting with a lower count overwrites (idempotent mirror)
  await ingestLeaderboard(db, [{ name: "Andy", bookingsToday: 6 }]);
  const board2 = await liveLeaderboard();
  expect(board2.find((r) => r.staffId === "andy")?.bookingsToday).toBe(6);
});
