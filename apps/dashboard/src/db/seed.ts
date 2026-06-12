/**
 * Seed the real floor — names, intake weights (Leaderboard col A) and daily
 * goals (col C) decoded from the company's sheet. Idempotent (upserts).
 *
 * Default PINs: reps "1234", manager "123456" — ROTATE IN /manage ON DAY ONE.
 * Run: pnpm --filter @nlr/dashboard db:seed   (PGlite locally, or set
 * DATABASE_URL to seed Supabase.)
 */
import { hashPin } from "../lib/auth-core";
import { newId } from "../lib/id";
import { getDb, schema } from "./client";
import { sydneyToday } from "../lib/sydney";

const REPS: Array<[id: string, name: string, weight: string, goal: number]> = [
  ["andy", "Andy", "1.1", 7],
  ["ann", "Ann", "0.9", 6],
  ["anthony", "Anthony", "0.5", 3],
  ["emilia", "Emilia", "0.7", 3],
  ["francis", "Francis", "1.1", 7],
  ["hadeel", "Hadeel", "1.1", 5],
  ["hanna", "Hanna", "0.7", 5],
  ["harry", "Harry", "1.1", 8],
  ["hermez", "Hermez", "1.0", 8],
  ["issac", "Issac", "1.1", 3],
  ["jenifer", "Jenifer", "1.1", 8],
  ["jessica", "Jessica", "1.1", 5],
  ["mariam", "Mariam", "0.8", 5],
  ["max", "Max", "1.1", 4],
  ["nisreen", "Nisreen", "1.1", 8],
  ["randee", "Randee", "1.1", 8],
];

async function seed() {
  const db = await getDb();
  const repPin = hashPin("1234");
  const managerPin = hashPin("123456");
  const today = sydneyToday();

  for (const [id, name, weight, goal] of REPS) {
    await db
      .insert(schema.staff)
      .values({ id, name, pinHash: repPin, intakeWeight: weight })
      .onConflictDoNothing();
    await db
      .insert(schema.goals)
      .values({ id: newId(), staffId: id, dailyTarget: goal, effectiveFrom: today })
      .onConflictDoNothing();
  }

  await db
    .insert(schema.staff)
    .values({ id: "manager", name: "Manager", role: "manager", pinHash: managerPin })
    .onConflictDoNothing();

  console.warn(`Seeded ${REPS.length} reps + manager. Default PINs 1234/123456 — rotate them.`);
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
