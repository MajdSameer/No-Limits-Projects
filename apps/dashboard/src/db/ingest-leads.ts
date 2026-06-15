/**
 * Ingest incoming quote leads pushed from the "Quote Leads" sheet
 * (api/ingest/leads + scripts/sheets/leads.gs). Each lead is deduped on the
 * sheet's own row id, mirrored into lead_inbox, and AUTO-ALLOCATED to the rep
 * who's next up by the sheet clock (recorded in `leads`, which the allocator
 * and boards already read). If no rep is eligible yet, the lead is parked
 * unallocated and a later push (or manual assign) can pick it up.
 */
import { eq } from "drizzle-orm";

import { newId } from "../lib/id";
import { schema, type Db } from "./client";
import { nextRepFromSheet } from "./queries/sheet-allocation";

export interface LeadRow {
  /** Stable id from the sheet (col N) — required for dedup. */
  sheetId: string;
  source?: string | null;
  contactName?: string | null;
  phone?: string | null;
  email?: string | null;
  details?: string | null;
  /** ISO datetime the lead arrived; defaults to now. */
  receivedAt?: string | null;
}

export interface LeadsIngestResult {
  total: number;
  allocated: number;
  unallocated: number;
  skipped: number;
}

function clean(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

export async function ingestLeads(
  db: Db,
  rows: LeadRow[],
  now: Date = new Date(),
): Promise<LeadsIngestResult> {
  const result: LeadsIngestResult = { total: 0, allocated: 0, unallocated: 0, skipped: 0 };

  for (const row of rows) {
    const sheetId = clean(row.sheetId);
    if (!sheetId) {
      result.skipped += 1;
      continue;
    }
    const [existing] = await db
      .select({ id: schema.leadInbox.id })
      .from(schema.leadInbox)
      .where(eq(schema.leadInbox.sheetId, sheetId))
      .limit(1);
    if (existing) {
      result.skipped += 1;
      continue;
    }
    result.total += 1;

    const source = clean(row.source);
    const receivedAt =
      row.receivedAt && !Number.isNaN(Date.parse(row.receivedAt)) ? new Date(row.receivedAt) : now;

    // Auto-allocate to the next-up rep (by the sheet's live clock).
    const repId = await nextRepFromSheet(now);

    await db.insert(schema.leadInbox).values({
      id: newId(),
      sheetId,
      receivedAt,
      source,
      contactName: clean(row.contactName),
      phone: clean(row.phone),
      email: clean(row.email),
      details: clean(row.details),
      allocatedTo: repId ?? null,
      allocatedAt: repId ? now : null,
    });

    if (repId) {
      // Record the allocation where the allocator/boards already look.
      await db
        .insert(schema.leads)
        .values({ id: newId(), staffId: repId, source: source ?? "lead", assignedBy: "auto", at: now });
      result.allocated += 1;
    } else {
      result.unallocated += 1;
    }
  }

  return result;
}
