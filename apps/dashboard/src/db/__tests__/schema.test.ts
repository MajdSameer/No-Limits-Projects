import { beforeAll, expect, test } from "vitest";

process.env.PGLITE_DIR = ":memory:";
const { db, dbReady, schema } = await import("../client");

beforeAll(async () => {
  await dbReady;
});

test("schema round-trip + unique job number", async () => {
  await db.insert(schema.staff).values({ id: "andy", name: "Andy", pinHash: "x" });
  await db.insert(schema.bookings).values({
    id: "b1",
    jobNumber: "98RRX",
    moveDate: "2026-07-01",
    salesRepId: "andy",
    createdBy: "andy",
  });

  const all = await db.select().from(schema.bookings);
  expect(all).toHaveLength(1);
  expect(all[0]?.type).toBe("moving");
  expect(all[0]?.company).toBe("NL");

  await expect(
    db.insert(schema.bookings).values({
      id: "b2",
      jobNumber: "98RRX",
      moveDate: "2026-07-02",
      salesRepId: "andy",
      createdBy: "andy",
    }),
  ).rejects.toThrow();
});
