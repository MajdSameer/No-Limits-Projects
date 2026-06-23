import { eq } from "drizzle-orm";
import { expect, test } from "vitest";

process.env.PGLITE_DIR = ":memory:";
const { getDb, schema } = await import("../client");
const {
  ingestMonthly,
  ingestMonthlyRevenue,
  ingestPipeline,
  monthRevenueKey,
  monthSettingKey,
  PIPELINE_KEY,
} = await import("../ingest-monthly");
const db = await getDb();

test("monthly ingest: slugs names, sums variants, stores a per-month blob", async () => {
  const res = await ingestMonthly(db, "2026-06", {
    Francis: 100,
    "Issac ": 60, // trailing space → same slug as "Issac"
    Issac: 0, // zero ignored
    "": 5, // blank name ignored
    Hanna: 46,
  });

  expect(res.month).toBe("2026-06");
  expect(res.total).toBe(206); // 100 + 60 + 46
  expect(res.reps).toBe(3);

  const [row] = await db
    .select()
    .from(schema.appSettings)
    .where(eq(schema.appSettings.key, monthSettingKey("2026-06")));
  expect(JSON.parse(row!.value)).toEqual({ francis: 100, issac: 60, hanna: 46 });

  // Re-push overwrites (idempotent), doesn't accumulate.
  const again = await ingestMonthly(db, "2026-06", { Francis: 101 });
  expect(again.total).toBe(101);
  const [row2] = await db
    .select()
    .from(schema.appSettings)
    .where(eq(schema.appSettings.key, monthSettingKey("2026-06")));
  expect(JSON.parse(row2!.value)).toEqual({ francis: 101 });
});

test("monthly ingest: rejects a malformed month", async () => {
  await expect(ingestMonthly(db, "2026/06", { Francis: 1 })).rejects.toThrow();
});

test("revenue ingest: slugs + sums net dollars, keeps zero/negatives, idempotent", async () => {
  const res = await ingestMonthlyRevenue(db, "2026-06", {
    Francis: 12000.5,
    "Issac ": 4000, // trailing space → same slug as "Issac"
    Issac: 500.25, // accumulates onto issac
    Hanna: 0, // zero kept (unlike the counts)
    Liam: -150, // a refund-net negative is kept
    "": 99, // blank name ignored
    Bad: Number.NaN, // non-finite dropped
  });

  expect(res.month).toBe("2026-06");
  expect(res.reps).toBe(4); // francis, issac, hanna, liam
  expect(res.total).toBeCloseTo(12000.5 + 4000 + 500.25 + 0 - 150);

  const [row] = await db
    .select()
    .from(schema.appSettings)
    .where(eq(schema.appSettings.key, monthRevenueKey("2026-06")));
  const stored = JSON.parse(row!.value) as Record<string, number>;
  expect(stored.francis).toBeCloseTo(12000.5);
  expect(stored.issac).toBeCloseTo(4500.25);
  expect(stored.hanna).toBe(0);
  expect(stored.liam).toBe(-150);

  // Re-push overwrites (idempotent), doesn't accumulate.
  const again = await ingestMonthlyRevenue(db, "2026-06", { Francis: 1 });
  expect(again.total).toBe(1);
  const [row2] = await db
    .select()
    .from(schema.appSettings)
    .where(eq(schema.appSettings.key, monthRevenueKey("2026-06")));
  expect(JSON.parse(row2!.value)).toEqual({ francis: 1 });
});

test("revenue ingest: rejects a malformed month", async () => {
  await expect(ingestMonthlyRevenue(db, "2026/06", { Francis: 1 })).rejects.toThrow();
});

test("pipeline ingest: slugs + stores the rolling next-3-months blob", async () => {
  const res = await ingestPipeline(db, { Francis: 40, "Hanna ": 25, Hanna: 0 });
  expect(res.total).toBe(65);
  expect(res.reps).toBe(2);
  const [row] = await db
    .select()
    .from(schema.appSettings)
    .where(eq(schema.appSettings.key, PIPELINE_KEY));
  expect(JSON.parse(row!.value)).toEqual({ francis: 40, hanna: 25 });
});
