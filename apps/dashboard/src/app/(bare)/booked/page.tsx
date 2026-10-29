import { and, asc, eq } from "drizzle-orm";

import { BookedForm } from "../../../components/BookedForm";
import { getDb, schema } from "../../../db/client";

export const metadata = { title: "Booked!", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Active reps for the two pick-lists: `submitters` (Q2, "what is your name?" — everyone,
 * so the /live tally is exact) and `reps` (Q3, who a job can be booked FOR). Dany is a
 * site inspector on /live (kept off the sales cards), so he can submit but isn't offered
 * as someone to book for. */
async function repNames(): Promise<{ submitters: string[]; reps: string[] }> {
  try {
    const db = await getDb();
    const rows = await db
      .select({ id: schema.staff.id, name: schema.staff.name })
      .from(schema.staff)
      .where(and(eq(schema.staff.active, true), eq(schema.staff.role, "rep")))
      .orderBy(asc(schema.staff.name));
    return { submitters: rows.map((r) => r.name), reps: rows.filter((r) => r.id !== "dany").map((r) => r.name) };
  } catch (err) {
    console.error("booked page: rep lookup failed:", err);
    return { submitters: [], reps: [] }; // the form falls back to plain text boxes
  }
}

/**
 * Public 3-question form (no login — a shared link): job number → your name →
 * who it's for. Submitting fires the instant celebration on the /live wall.
 */
export default async function BookedPage() {
  const { submitters, reps } = await repNames();
  return <BookedForm reps={reps} submitters={submitters} />;
}
