/** Read the incoming-lead inbox (most recent first) with the allocated rep. */
import { desc, eq } from "drizzle-orm";

import { getDb, schema } from "../client";

export interface InboxRow {
  id: string;
  receivedAtISO: string;
  source: string | null;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  details: string | null;
  allocatedTo: string | null;
  repName: string | null;
}

export async function leadInbox(limit = 100): Promise<InboxRow[]> {
  const db = await getDb();
  const rows = await db
    .select({ lead: schema.leadInbox, repName: schema.staff.name })
    .from(schema.leadInbox)
    .leftJoin(schema.staff, eq(schema.leadInbox.allocatedTo, schema.staff.id))
    .orderBy(desc(schema.leadInbox.receivedAt))
    .limit(limit);

  return rows.map(({ lead, repName }) => ({
    id: lead.id,
    receivedAtISO: lead.receivedAt.toISOString(),
    source: lead.source,
    contactName: lead.contactName,
    phone: lead.phone,
    email: lead.email,
    details: lead.details,
    allocatedTo: lead.allocatedTo,
    repName,
  }));
}
