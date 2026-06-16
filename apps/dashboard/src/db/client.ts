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
      // One connection per instance: a request's queries queue through it
      // instead of each grabbing its own. With a big pool every Vercel instance
      // held many idle connections forever until Supabase ran out — then the
      // busiest endpoint (the board, ~17 queries) hung while single-query pages
      // still squeaked through on the last free slot. max:1 means the board
      // needs only the one slot that's provably free (the same one /live uses),
      // so it recovers without waiting for the leaked connections to age out.
      // Queries to Supabase are a few ms each, so serialising them is fine.
      max: 1,
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
