import { eq } from "drizzle-orm";
import { beforeAll, expect, test } from "vitest";

process.env.PGLITE_DIR = ":memory:";
const { getDb, schema } = await import("../client");
const { ingestLeads } = await import("../ingest-leads");
const { sydneyToday } = await import("../../lib/sydney");
const db = await getDb();

const today = sydneyToday();

beforeAll(async () => {
  await db.insert(schema.staff).values([
    { id: "andy", name: "Andy", pinHash: "x", intakeWeight: "1.0", role: "rep" },
    { id: "ann", name: "Ann", pinHash: "x", intakeWeight: "1.0", role: "rep" },
  ]);
  // Both clocked in (sheet clock), so leads can be auto-allocated.
  await db.insert(schema.repLive).values([
    { staffId: "andy", timeIn: "08:00", workingHours: "4.00", asOfDate: today },
    { staffId: "ann", timeIn: "08:00", workingHours: "4.00", asOfDate: today },
  ]);
});

test("leads ingest: dedup + auto-allocate to the next-up rep", async () => {
  const res = await ingestLeads(db, [
    { sheetId: "L1", contactName: "Alice", source: "google", phone: "0400000001" },
    { sheetId: "L2", contactName: "Bob", source: "google" },
    { sheetId: "", contactName: "NoId" }, // skipped (no dedup key)
  ]);

  expect(res.total).toBe(2);
  expect(res.allocated).toBe(2);
  expect(res.unallocated).toBe(0);
  expect(res.skipped).toBe(1);

  // Two equal reps → fairness spreads the two leads one each.
  const inbox = await db.select().from(schema.leadInbox);
  const allocated = inbox.map((r) => r.allocatedTo).sort();
  expect(allocated).toEqual(["andy", "ann"]);

  // The allocations are recorded where the allocator/boards read them.
  const leads = await db.select().from(schema.leads);
  expect(leads).toHaveLength(2);
  expect(leads.every((l) => l.assignedBy === "auto")).toBe(true);

  // Re-pushing the same sheet ids changes nothing.
  const again = await ingestLeads(db, [{ sheetId: "L1", contactName: "Alice" }]);
  expect(again.skipped).toBe(1);
  expect(again.total).toBe(0);

  // Nobody on shift → lead is parked, not allocated.
  await db.update(schema.repLive).set({ timeOut: "17:00" }).where(eq(schema.repLive.staffId, "andy"));
  await db.update(schema.repLive).set({ timeOut: "17:00" }).where(eq(schema.repLive.staffId, "ann"));
  const parked = await ingestLeads(db, [{ sheetId: "L3", contactName: "Carol" }]);
  expect(parked.allocated).toBe(0);
  expect(parked.unallocated).toBe(1);
  const [c] = await db.select().from(schema.leadInbox).where(eq(schema.leadInbox.sheetId, "L3"));
  expect(c?.allocatedTo).toBeNull();
});
