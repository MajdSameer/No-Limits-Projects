/**
 * Env-switched database client:
 *  - DATABASE_URL set  -> Supabase Postgres via postgres-js (prod / staging)
 *  - otherwise         -> PGlite (./.pglite dir; ":memory:" in tests),
 *                         auto-migrated on first use.
 * Both run the exact same Drizzle schema and SQL migrations.
 *
 * Initialisation is LAZY (first getDb() call), never at module import —
 * `next build` evaluates module graphs in parallel workers and must not
 * trigger PGlite migrations. All db-touching routes are dynamic.
 */
import path from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite, type PgliteDatabase } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { drizzle as drizzlePg, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

export type Db = PostgresJsDatabase<typeof schema> | PgliteDatabase<typeof schema>;

const globalForDb = globalThis as unknown as { __nlDbPromise?: Promise<Db> };

async function create(): Promise<Db> {
  if (process.env.DATABASE_URL) {
    // DATABASE_URL points at Supabase's transaction pooler (port 6543), which is
    // built for many short-lived serverless connections, so a normal pool is
    // fine — the board's queries can fan out again. idle_timeout closes idle
    // connections so they can't accumulate across instances; connect_timeout
    // fails fast instead of hanging. prepare:false is required for the pooler.
    const client = postgres(process.env.DATABASE_URL, {
      prepare: false,
      max: 10,
      idle_timeout: 20,
      max_lifetime: 60 * 10,
      connect_timeout: 10,
    });
    return drizzlePg(client, { schema });
  }
  const dataDir =
    process.env.PGLITE_DIR === ":memory:"
      ? undefined
      : (process.env.PGLITE_DIR ?? path.join(process.cwd(), ".pglite"));
  const pglite = new PGlite(dataDir);
  const db = drizzlePglite(pglite, { schema });
  await migratePglite(db, { migrationsFolder: path.join(process.cwd(), "src/db/migrations") });
  return db;
}

/** The app-wide database handle (created + migrated on first call). */
export function getDb(): Promise<Db> {
  globalForDb.__nlDbPromise ??= create();
  return globalForDb.__nlDbPromise;
}

export { schema };
