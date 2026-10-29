import { and, asc, eq } from "drizzle-orm";

import { BookedForm } from "../../../components/BookedForm";
import { getDb, schema } from "../../../db/client";

export const metadata = { title: "Booked!", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Active sales reps for the "who is it for" picker. Dany is a site inspector on
 * /live (kept off the sales cards), so he isn't offered as a rep here either. */
async function repNames(): Promise<string[]> {
  try {
    const db = await getDb();
    const rows = await db
      .select({ id: schema.staff.id, name: schema.staff.name })
      .from(schema.staff)
      .where(and(eq(schema.staff.active, true), eq(schema.staff.role, "rep")))
      .orderBy(asc(schema.staff.name));
    return rows.filter((r) => r.id !== "dany").map((r) => r.name);
  } catch (err) {
    console.error("booked page: rep lookup failed:", err);
    return []; // the form falls back to a plain text box
  }
}

/**
 * Public 3-question form (no login — a shared link): job number → your name →
 * who it's for. Submitting fires the instant celebration on the /live wall.
 */
export default async function BookedPage() {
  return <BookedForm reps={await repNames()} />;
}
