/**
 * Sync the floor roster from the live "Leaderboard" sheet into the database:
 * each rep's name, lead intake weight and daily goal. The Google Sheet is the
 * company's source of truth — this replaces the values that used to be
 * hand-decoded into seed.ts. Idempotent: safe to re-run and to run on a
 * schedule (api/cron/sync-sheet).
 *
 * Scope is deliberately narrow. It NEVER touches PINs, roles, gender or the
 * Game-Day team — those aren't in the Leaderboard tab and are managed in
 * /manage. New names found in the sheet are created with the default PIN
 * "1234" (rotate in /manage); reps no longer in the sheet are left untouched
 * (deactivate them in /manage rather than deleting history).
 *
 * Run: pnpm --filter @nlr/dashboard db:sync-sheet
 */
import { pathToFileURL } from "node:url";

import { and, eq } from "drizzle-orm";

import { hashPin } from "../lib/auth-core";
import { newId } from "../lib/id";
import { readLeaderboardReps } from "../lib/sheets";
import { sydneyToday } from "../lib/sydney";
import { getDb, schema, type Db } from "./client";

export interface SyncResult {
  /** ids created (new names from the sheet). */
  added: string[];
  /** ids whose name or intake weight changed. */
  updated: string[];
  /** ids whose daily goal for today was set or changed. */
  goalsChanged: string[];
  /** total reps read from the sheet. */
  total: number;
}

export async function syncStaffFromSheet(db: Db): Promise<SyncResult> {
  const reps = await readLeaderboardReps();
  const today = sydneyToday();
  const result: SyncResult = { added: [], updated: [], goalsChanged: [], total: reps.length };

  for (const rep of reps) {
    const [existing] = await db
      .select({ name: schema.staff.name, intakeWeight: schema.staff.intakeWeight })
      .from(schema.staff)
      .where(eq(schema.staff.id, rep.id))
      .limit(1);

    if (!existing) {
      await db.insert(schema.staff).values({
        id: rep.id,
        name: rep.name,
        pinHash: hashPin("1234"),
        intakeWeight: rep.intakeWeight,
      });
      result.added.push(rep.id);
      // Compare weights numerically so "1" vs "1.0" isn't a phantom change.
    } else if (existing.name !== rep.name || Number(existing.intakeWeight) !== Number(rep.intakeWeight)) {
      await db
        .update(schema.staff)
        .set({ name: rep.name, intakeWeight: rep.intakeWeight })
        .where(eq(schema.staff.id, rep.id));
      result.updated.push(rep.id);
    }

    // Daily goal for today — insert it, or update the value if it drifted.
    const [goal] = await db
      .select({ id: schema.goals.id, dailyTarget: schema.goals.dailyTarget })
      .from(schema.goals)
      .where(and(eq(schema.goals.staffId, rep.id), eq(schema.goals.effectiveFrom, today)))
      .limit(1);

    if (!goal) {
      await db.insert(schema.goals).values({
        id: newId(),
        staffId: rep.id,
        dailyTarget: rep.dailyTarget,
        effectiveFrom: today,
      });
      result.goalsChanged.push(rep.id);
    } else if (goal.dailyTarget !== rep.dailyTarget) {
      await db
        .update(schema.goals)
        .set({ dailyTarget: rep.dailyTarget })
        .where(eq(schema.goals.id, goal.id));
      result.goalsChanged.push(rep.id);
    }
  }

  return result;
}

// CLI entry point — only when run directly (`tsx src/db/sync-from-sheet.ts`),
// not when imported by the cron route.
const entryPoint = process.argv[1];
const runDirectly = entryPoint !== undefined && import.meta.url === pathToFileURL(entryPoint).href;

if (runDirectly) {
  getDb()
    .then((db) => syncStaffFromSheet(db))
    .then((r) => {
      console.warn(
        `Sheet sync: ${r.total} reps read · ${r.added.length} added · ` +
          `${r.updated.length} updated · ${r.goalsChanged.length} goals set/changed.`,
      );
      if (r.added.length) console.warn(`  added:   ${r.added.join(", ")}`);
      if (r.updated.length) console.warn(`  updated: ${r.updated.join(", ")}`);
      process.exit(0);
    })
    .catch((err: unknown) => {
      console.error(err);
      process.exit(1);
    });
}
