import { asc, eq } from "drizzle-orm";

import { getDb, schema } from "../../../db/client";
import { SignInForm } from "../../../components/SignInForm";

export const metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function SignInPage() {
  const db = await getDb();
  const staff = await db
    .select({ id: schema.staff.id, name: schema.staff.name, role: schema.staff.role })
    .from(schema.staff)
    .where(eq(schema.staff.active, true))
    .orderBy(asc(schema.staff.name));

  return (
    <main id="main" className="grid min-h-dvh place-items-center bg-ink-950 px-4 py-10">
      <div className="w-full max-w-2xl">
        <header className="mb-8 text-center">
          <p className="font-mono text-xs font-bold tracking-[0.3em] text-accent-400 uppercase">
            No Limits Removalists
          </p>
          <h1 className="font-display mt-2 text-5xl font-bold tracking-wide text-manila-100 uppercase">
            Ops sign-in
          </h1>
        </header>
        <SignInForm staff={staff} />
      </div>
    </main>
  );
}
