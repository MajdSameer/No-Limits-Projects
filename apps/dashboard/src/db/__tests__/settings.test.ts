import { expect, test } from "vitest";

process.env.PGLITE_DIR = ":memory:";
const { getDb } = await import("../client");
const { setSetting, getTopRevenueJob } = await import("../settings");
const { sydneyToday } = await import("../../lib/sydney");
await getDb();

test("top revenue job winner shows only for today, then auto-clears", async () => {
  expect(await getTopRevenueJob()).toBeNull(); // nothing set yet

  const today = sydneyToday();
  await setSetting("top_revenue_job", JSON.stringify({ date: today, staffId: "andy", name: "Andy" }));
  expect(await getTopRevenueJob()).toEqual({ staffId: "andy", name: "Andy" });

  // A snapshot from a previous day no longer counts — back to null.
  await setSetting(
    "top_revenue_job",
    JSON.stringify({ date: "2020-01-01", staffId: "andy", name: "Andy" }),
  );
  expect(await getTopRevenueJob()).toBeNull();

  // Explicitly cleared.
  await setSetting("top_revenue_job", "");
  expect(await getTopRevenueJob()).toBeNull();
});
