import { eq } from "drizzle-orm";
import { expect, test } from "vitest";

process.env.PGLITE_DIR = ":memory:";
const { getDb, schema } = await import("../client");
const { ingestMonthly, monthSettingKey } = await import("../ingest-monthly");
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
