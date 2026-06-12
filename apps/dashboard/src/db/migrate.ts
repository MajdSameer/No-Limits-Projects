/**
 * Apply SQL migrations to a real Postgres (Supabase) — run locally with
 * DATABASE_URL set. (PGlite auto-migrates in client.ts; prod can instead
 * paste `pnpm --filter @nlr/dashboard db:sql` into the Supabase SQL editor.)
 */
import path from "node:path";

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required (Supabase pooler or direct URL).");
  process.exit(1);
}

const client = postgres(url, { prepare: false, max: 1 });
migrate(drizzle(client), {
  migrationsFolder: path.join(process.cwd(), "src/db/migrations"),
})
  .then(async () => {
    await client.end();
    console.warn("Migrations applied.");
  })
  .catch(async (err) => {
    console.error(err);
    await client.end();
    process.exit(1);
  });
