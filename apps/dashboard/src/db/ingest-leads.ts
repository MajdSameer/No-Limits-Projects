/**
 * Ingest incoming quote leads pushed from the "Quote Leads" sheet
 * (api/ingest/leads + scripts/sheets/leads.gs). Each lead is deduped on the
 * sheet's own row id, mirrored into lead_inbox, and AUTO-ALLOCATED to the rep
 * who's next up by the sheet clock (recorded in `leads`, which the allocator
 * and boards already read). If no rep is eligible yet, the lead is parked
 * unallocated and a later push (or manual assign) can pick it up.
 */
import { inArray } from "drizzle-orm";

import { allocate } from "../lib/lead-allocation";
import { newId } from "../lib/id";
import { schema, type Db } from "./client";
import { buildSheetCandidates } from "./queries/sheet-allocation";

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

  // Keep only rows with a dedup key, last one wins within the batch.
  const byId = new Map<string, LeadRow>();
  for (const row of rows) {
    const sheetId = clean(row.sheetId);
    if (!sheetId) {
      result.skipped += 1;
      continue;
    }
    byId.set(sheetId, row);
  }
  if (byId.size === 0) return result;

  // Drop any sheet ids we've already mirrored (one query, not one per row).
  const ids = [...byId.keys()];
  const seen = await db
    .select({ sheetId: schema.leadInbox.sheetId })
    .from(schema.leadInbox)
    .where(inArray(schema.leadInbox.sheetId, ids));
  for (const r of seen) {
    if (byId.delete(r.sheetId)) result.skipped += 1;
  }
  if (byId.size === 0) return result;

  // Allocate the whole batch in memory off a single candidate snapshot,
  // bumping each pick's leadsToday so fairness carries across the batch
  // exactly as per-row allocation would, without re-querying.
  const candidates = await buildSheetCandidates(now);
  const byStaff = new Map(candidates.map((c) => [c.staffId, c]));

  const inboxValues: (typeof schema.leadInbox.$inferInsert)[] = [];
  const leadValues: (typeof schema.leads.$inferInsert)[] = [];

  for (const [sheetId, row] of byId) {
    result.total += 1;
    const source = clean(row.source);
    const receivedAt =
      row.receivedAt && !Number.isNaN(Date.parse(row.receivedAt)) ? new Date(row.receivedAt) : now;

    const repId = allocate(candidates).nextUp;

    inboxValues.push({
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
      leadValues.push({ id: newId(), staffId: repId, source: source ?? "lead", assignedBy: "auto", at: now });
      const c = byStaff.get(repId);
      if (c) c.leadsToday += 1; // carry fairness to the next pick in this batch
      result.allocated += 1;
    } else {
      result.unallocated += 1;
    }
  }

  const CHUNK = 200;
  for (let i = 0; i < inboxValues.length; i += CHUNK) {
    await db.insert(schema.leadInbox).values(inboxValues.slice(i, i + CHUNK));
  }
  for (let i = 0; i < leadValues.length; i += CHUNK) {
    await db.insert(schema.leads).values(leadValues.slice(i, i + CHUNK));
  }

  return result;
}
