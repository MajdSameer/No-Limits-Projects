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

// gender ('f'|'m'|'x') is a BEST GUESS from first names — managers correct
// any wrong ones in /manage. team = the Game Day split from the sheet's
// Game Day tab (Orange left columns vs Blue right columns).
type Gender = "f" | "m" | "x";
type Team = "orange" | "blue";
const REPS: Array<[id: string, name: string, weight: string, goal: number, gender: Gender, team: Team]> = [
  ["andy", "Andy", "1.1", 7, "m", "blue"],
  ["ann", "Ann", "0.9", 6, "f", "orange"],
  ["anthony", "Anthony", "0.5", 3, "m", "orange"],
  ["emilia", "Emilia", "0.7", 3, "f", "orange"],
  ["francis", "Francis", "1.1", 7, "m", "orange"],
  ["hadeel", "Hadeel", "1.1", 5, "f", "orange"],
  ["hanna", "Hanna", "0.7", 5, "f", "orange"],
  ["harry", "Harry", "1.1", 8, "m", "blue"],
  ["hermez", "Hermez", "1.0", 8, "m", "blue"],
  ["issac", "Issac", "1.1", 3, "m", "orange"],
  ["jenifer", "Jenifer", "1.1", 8, "f", "blue"],
  ["jessica", "Jessica", "1.1", 5, "f", "orange"],
  ["mariam", "Mariam", "0.8", 5, "f", "blue"],
  ["max", "Max", "1.1", 4, "m", "blue"],
  ["nisreen", "Nisreen", "1.1", 8, "f", "blue"],
  ["randee", "Randee", "1.1", 8, "m", "orange"],
];

async function seed() {
  const db = await getDb();
  const repPin = hashPin("1234");
  const managerPin = hashPin("123456");
  const today = sydneyToday();

  for (const [id, name, weight, goal, gender, team] of REPS) {
    await db
      .insert(schema.staff)
      .values({ id, name, pinHash: repPin, intakeWeight: weight, gender, team })
      .onConflictDoUpdate({ target: schema.staff.id, set: { gender, team } });
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
