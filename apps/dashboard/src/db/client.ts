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
    // Serverless-safe pool. Each Vercel instance handles one request at a time,
    // so a tiny pool is plenty; without an idle timeout, postgres-js keeps
    // connections open forever and instances pile up until Supabase refuses new
    // ones and every query hangs. connect_timeout fails fast instead of hanging.
    //   prepare:false — required behind Supabase's transaction pooler.
    const client = postgres(process.env.DATABASE_URL, {
      prepare: false,
      // Small pool. Opening many Supabase-pooler connections at once stalls this
      // instance's tiny DB, so the board (~17 queries) must not fan out wide.
      // The board is now computed behind a short cache that coalesces concurrent
      // requests (see boards-snapshot), so only ONE board computation runs at a
      // time per instance — a pool of 3 lets that single computation finish
      // quickly without the cross-request connection storm that 504'd before.
      // idle_timeout closes idle connections so they can't accumulate (the
      // original outage); connect_timeout fails fast instead of hanging.
      max: 3,
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
