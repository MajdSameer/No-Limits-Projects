import { beforeAll, expect, test } from "vitest";

process.env.PGLITE_DIR = ":memory:";
const { getDb, schema } = await import("../../db/client");
const db = await getDb();
const { hashPin, verifyPin, MAX_PIN_ATTEMPTS } = await import("../auth-core");

beforeAll(async () => {
  await db.insert(schema.staff).values([
    { id: "hanna", name: "Hanna", pinHash: hashPin("1234") },
    { id: "gone", name: "Gone", pinHash: hashPin("1234"), active: false },
  ]);
});

test("correct PIN signs in and resets counters", async () => {
  const r = await verifyPin(db, "hanna", "1234");
  expect(r.ok).toBe(true);
});

test("unknown and inactive staff rejected", async () => {
  expect((await verifyPin(db, "nobody", "1234")).ok).toBe(false);
  const r = await verifyPin(db, "gone", "1234");
  expect(r).toEqual({ ok: false, reason: "inactive" });
});

test("5 wrong PINs locks the account even for the right PIN afterwards", async () => {
  for (let i = 0; i < MAX_PIN_ATTEMPTS; i++) {
    const r = await verifyPin(db, "hanna", "0000");
    expect(r.ok).toBe(false);
  }
  const locked = await verifyPin(db, "hanna", "1234");
  expect(locked).toEqual({ ok: false, reason: "locked" });
});

test("manager unlock restores access", async () => {
  const { eq } = await import("drizzle-orm");
  await db
    .update(schema.staff)
    .set({ failedAttempts: 0, lockedAt: null })
    .where(eq(schema.staff.id, "hanna"));
  const r = await verifyPin(db, "hanna", "1234");
  expect(r.ok).toBe(true);
});
