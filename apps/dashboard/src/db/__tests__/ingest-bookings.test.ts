import { and, eq } from "drizzle-orm";
import { beforeAll, expect, test } from "vitest";

process.env.PGLITE_DIR = ":memory:";
const { getDb, schema } = await import("../client");
const { ingestBookings } = await import("../ingest-bookings");
const { subcontractorBookings } = await import("../queries/bookings");
const db = await getDb();

beforeAll(async () => {
  await db.insert(schema.staff).values({ id: "francis", name: "Francis", pinHash: "x" });
});

test("bookings ingest: maps fields, gates reps/companies, flags subcontractor", async () => {
  const res = await ingestBookings(db, [
    // roster rep, NL — kept
    {
      jobNumber: "98RRX",
      company: "NO LIMITS REMOVALISTS",
      moveDate: "2026-06-20",
      salesPerson: "Francis",
      customerName: "Sophie",
      state: "NSW",
      beds: "3",
      deposit: "$100",
    },
    // subcontractor — kept + flagged, creates inactive staff
    {
      jobNumber: "E76VZ",
      company: "RRR Removals",
      moveDate: "2026-06-21",
      salesPerson: "Domanic",
      customerName: "Caitlin",
    },
    // unknown rep — skipped
    { jobNumber: "ZZZ11", company: "NO LIMITS REMOVALISTS", moveDate: "2026-06-22", salesPerson: "Avan" },
    // other company — skipped
    { jobNumber: "OC123", company: "OTHER COMPANY", moveDate: "2026-06-22", salesPerson: "Francis" },
    // no date — skipped
    { jobNumber: "NODATE", company: "NO LIMITS REMOVALISTS", moveDate: "", salesPerson: "Francis" },
  ]);

  expect(res.inserted).toBe(2);
  expect(res.skipped.unknownRep).toBe(1);
  expect(res.skipped.badCompany).toBe(1);
  expect(res.skipped.noDateOrJob).toBe(1);

  // Domanic created as INACTIVE staff (off the board)
  const [dom] = await db
    .select({ active: schema.staff.active })
    .from(schema.staff)
    .where(eq(schema.staff.id, "domanic"));
  expect(dom?.active).toBe(false);

  const [nl] = await db
    .select()
    .from(schema.bookings)
    .where(eq(schema.bookings.jobNumber, "98RRX"));
  expect(nl?.company).toBe("NL");
  expect(nl?.subcontractor).toBe(false);
  expect(nl?.beds).toBe(3);
  expect(nl?.deposit).toBe("100");

  // subcontractor view (month tab) shows Domanic's job, not Francis's
  const month = await subcontractorBookings("month", new Date("2026-06-15T02:00:00Z"));
  expect(month.map((r) => r.booking.jobNumber)).toEqual(["E76VZ"]);

  // re-push updates, doesn't duplicate (unique job number)
  const again = await ingestBookings(db, [
    { jobNumber: "98RRX", company: "NO LIMITS REMOVALISTS", moveDate: "2026-06-20", salesPerson: "Francis", customerName: "Sophie R" },
  ]);
  expect(again.updated).toBe(1);
  const dupes = await db
    .select()
    .from(schema.bookings)
    .where(and(eq(schema.bookings.jobNumber, "98RRX"), eq(schema.bookings.subcontractor, false)));
  expect(dupes).toHaveLength(1);
  expect(dupes[0]?.customerName).toBe("Sophie R");
});
