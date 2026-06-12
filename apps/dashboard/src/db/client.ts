/**
 * Env-switched database client:
 *  - DATABASE_URL set  -> Supabase Postgres via postgres-js (prod / staging)
 *  - otherwise         -> PGlite (./.pglite dir; ":memory:" in tests),
 *                         auto-migrated on first use.
 * Both run the exact same Drizzle schema and SQL migrations.
 */
import path from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite, type PgliteDatabase } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { drizzle as drizzlePg, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

export type Db = PostgresJsDatabase<typeof schema> | PgliteDatabase<typeof schema>;

const globalForDb = globalThis as unknown as {
  __nlDb?: Db;
  __nlDbReady?: Promise<unknown>;
};

function create(): { db: Db; ready: Promise<unknown> } {
  if (process.env.DATABASE_URL) {
    // prepare:false — required behind Supabase's transaction pooler.
    const client = postgres(process.env.DATABASE_URL, { prepare: false });
    return { db: drizzlePg(client, { schema }), ready: Promise.resolve() };
  }
  const dataDir =
    process.env.PGLITE_DIR === ":memory:"
      ? undefined
      : (process.env.PGLITE_DIR ?? path.join(process.cwd(), ".pglite"));
  const pglite = new PGlite(dataDir);
  const db = drizzlePglite(pglite, { schema });
  const ready = migratePglite(db, {
    migrationsFolder: path.join(process.cwd(), "src/db/migrations"),
  });
  return { db, ready };
}

const inst = globalForDb.__nlDb
  ? { db: globalForDb.__nlDb, ready: globalForDb.__nlDbReady ?? Promise.resolve() }
  : create();
globalForDb.__nlDb = inst.db;
globalForDb.__nlDbReady = inst.ready;

export const db = inst.db;
/** Await before querying — resolves instantly on Postgres, after migration on PGlite. */
export const dbReady = inst.ready;
export { schema };
