import { beforeAll, expect, test } from "vitest";

process.env.PGLITE_DIR = ":memory:";
const { getDb, schema } = await import("../../db/client");
const db = await getDb();
const { createBooking, setBookingDeleted, updateBookingRecord } = await import("../bookings-core");

const andy = { staffId: "andy", role: "rep" as const };
const hanna = { staffId: "hanna", role: "rep" as const };
const boss = { staffId: "manager", role: "manager" as const };

beforeAll(async () => {
  await db.insert(schema.staff).values([
    { id: "andy", name: "Andy", pinHash: "x" },
    { id: "hanna", name: "Hanna", pinHash: "x" },
    { id: "manager", name: "Manager", role: "manager", pinHash: "x" },
  ]);
});

test("quick-add with three fields succeeds and normalises the job number", async () => {
  const r = await createBooking(db, andy, { jobNumber: " 98rrx ", type: "moving", moveDate: "2026-07-01" });
  expect(r.ok).toBe(true);
  if (r.ok) expect(r.jobNumber).toBe("98RRX");
});

test("duplicate job number reports who entered it", async () => {
  const r = await createBooking(db, hanna, { jobNumber: "98RRX", type: "storage", moveDate: "2026-07-02" });
  expect(r.ok).toBe(false);
  if (!r.ok && r.error === "duplicate") expect(r.byName).toBe("Andy");
});

test("garbage inputs rejected", async () => {
  expect((await createBooking(db, andy, { jobNumber: "x", type: "moving", moveDate: "2026-07-01" })).ok).toBe(false);
  expect((await createBooking(db, andy, { jobNumber: "ABCDE", type: "moving", moveDate: "not-a-date" })).ok).toBe(false);
});

test("reps edit own, not others; managers edit anything", async () => {
  const created = await createBooking(db, andy, { jobNumber: "AAA11", type: "moving", moveDate: "2026-07-03" });
  const id = created.ok ? created.id : "";

  const own = await updateBookingRecord(db, andy, id, { customerName: "Sherae" });
  expect(own.ok).toBe(true);
  if (own.ok) expect(own.diff.customerName?.to).toBe("Sherae");

  expect((await updateBookingRecord(db, hanna, id, { customerName: "Nope" })).ok).toBe(false);

  const mgr = await updateBookingRecord(db, boss, id, { value: "2320" });
  expect(mgr.ok).toBe(true);
});

test("numeric fields validated; empty string clears to null", async () => {
  const created = await createBooking(db, andy, { jobNumber: "BBB22", type: "moving", moveDate: "2026-07-04", customerName: "Tim" });
  const id = created.ok ? created.id : "";
  expect((await updateBookingRecord(db, andy, id, { beds: "three" })).ok).toBe(false);
  const cleared = await updateBookingRecord(db, andy, id, { customerName: "" });
  expect(cleared.ok && cleared.diff.customerName?.to).toBe(null);
});

test("soft delete is manager-only; deleted rows aren't editable", async () => {
  const created = await createBooking(db, andy, { jobNumber: "CCC33", type: "cleaning", moveDate: "2026-07-05" });
  const id = created.ok ? created.id : "";
  expect((await setBookingDeleted(db, andy, id, true)).ok).toBe(false);
  expect((await setBookingDeleted(db, boss, id, true)).ok).toBe(true);
  expect((await updateBookingRecord(db, andy, id, { notes: "hi" })).ok).toBe(false);
  expect((await setBookingDeleted(db, boss, id, false)).ok).toBe(true);
});
