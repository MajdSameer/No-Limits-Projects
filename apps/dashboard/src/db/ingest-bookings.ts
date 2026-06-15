/**
 * Ingest bookings pushed from the "Booking" tab (No Limits & RRR Removals
 * sheet) via api/ingest/bookings + scripts/sheets/bookings.gs. The sheet is the
 * source of truth; upsert is keyed on the unique job number, so re-pushing is
 * idempotent.
 *
 * Rep policy (per product decision): only the existing floor reps plus the
 * subcontractor "Domanic" are imported — Domanic's jobs are flagged
 * `subcontractor` and shown on /subcontractor. Bookings by any other
 * non-roster name (ex-staff, other contractors) are skipped, as are rows for
 * companies that aren't NL/RRR/PM.
 */
import { eq } from "drizzle-orm";

import { hashPin } from "../lib/auth-core";
import { newId } from "../lib/id";
import { slug } from "../lib/slug";
import { schema, type Db } from "./client";

export interface BookingRow {
  jobNumber: string;
  company?: string | null;
  /** Move date as ISO "yyyy-MM-dd" (the Apps Script sends the cell's Date). */
  moveDate: string;
  salesPerson?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  pickup?: string | null;
  delivery?: string | null;
  state?: string | null;
  beds?: number | string | null;
  cubic?: number | string | null;
  men?: number | string | null;
  deposit?: number | string | null;
  leadSource?: string | null;
  notes?: string | null;
}

export interface BookingsIngestResult {
  total: number;
  inserted: number;
  updated: number;
  skipped: { unknownRep: number; badCompany: number; noDateOrJob: number };
}

const SUBCONTRACTOR_ID = "domanic";

const COMPANY_MAP: Record<string, "NL" | "RRR" | "PM"> = {
  "no limits removalists": "NL",
  "no limits removals": "NL",
  "rrr removals": "RRR",
  rrr: "RRR",
  "professional movers": "PM",
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function str(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}
function intOrNull(v: unknown): number | null {
  if (v === null || v === undefined || String(v).trim() === "") return null;
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) ? n : null;
}
function numOrNull(v: unknown): string | null {
  if (v === null || v === undefined || String(v).trim() === "") return null;
  const n = Number(String(v).replace(/[$,]/g, ""));
  return Number.isFinite(n) ? String(n) : null;
}

export async function ingestBookings(db: Db, rows: BookingRow[]): Promise<BookingsIngestResult> {
  const result: BookingsIngestResult = {
    total: 0,
    inserted: 0,
    updated: 0,
    skipped: { unknownRep: 0, badCompany: 0, noDateOrJob: 0 },
  };

  // Preload known staff ids so we only import roster reps (+ Domanic).
  const staffRows = await db.select({ id: schema.staff.id }).from(schema.staff);
  const known = new Set(staffRows.map((s) => s.id));

  for (const row of rows) {
    const jobNumber = str(row.jobNumber);
    const moveDate = str(row.moveDate);
    if (!jobNumber || !moveDate || !ISO_DATE.test(moveDate)) {
      result.skipped.noDateOrJob += 1;
      continue;
    }
    const company = COMPANY_MAP[String(row.company ?? "").trim().toLowerCase()];
    if (!company) {
      result.skipped.badCompany += 1;
      continue;
    }
    const repId = slug(str(row.salesPerson) ?? "");
    const isSub = repId === SUBCONTRACTOR_ID;
    if (!repId || (!known.has(repId) && !isSub)) {
      result.skipped.unknownRep += 1;
      continue;
    }
    if (isSub && !known.has(SUBCONTRACTOR_ID)) {
      // Create the subcontractor as inactive staff so it's off the board but
      // still satisfies the salesRep/createdBy foreign keys.
      await db
        .insert(schema.staff)
        .values({ id: SUBCONTRACTOR_ID, name: "Domanic", pinHash: hashPin("1234"), active: false });
      known.add(SUBCONTRACTOR_ID);
    }
    result.total += 1;

    const fields = {
      company,
      customerName: str(row.customerName),
      customerPhone: str(row.customerPhone),
      customerEmail: str(row.customerEmail),
      pickup: str(row.pickup),
      delivery: str(row.delivery),
      state: str(row.state),
      moveDate,
      deposit: numOrNull(row.deposit),
      beds: intOrNull(row.beds),
      cubic: intOrNull(row.cubic),
      men: intOrNull(row.men),
      leadSource: str(row.leadSource),
      notes: str(row.notes),
      subcontractor: isSub,
      salesRepId: repId,
    };

    const [existing] = await db
      .select({ id: schema.bookings.id })
      .from(schema.bookings)
      .where(eq(schema.bookings.jobNumber, jobNumber))
      .limit(1);

    if (existing) {
      await db
        .update(schema.bookings)
        .set({ ...fields, updatedAt: new Date() })
        .where(eq(schema.bookings.id, existing.id));
      result.updated += 1;
    } else {
      await db.insert(schema.bookings).values({
        id: newId(),
        jobNumber,
        ...fields,
        createdBy: repId,
        // Bucket the leaderboard on the job date (~Sydney midday), not import time.
        enteredAt: new Date(`${moveDate}T02:00:00.000Z`),
      });
      result.inserted += 1;
    }
  }

  return result;
}
