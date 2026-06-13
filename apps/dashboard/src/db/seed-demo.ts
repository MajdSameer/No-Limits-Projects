/**
 * DEMO DAY — paints a realistic random day onto the board so you can see it
 * alive: varied bookings/types, someone who hit target, someone way over
 * (cheeky tier), live clock states and leads for the allocator.
 *
 * Safe + reversible: everything it creates is marked (bookings job numbers
 * start "DEMO-", clock/lead rows use source "demo"). Re-running wipes the
 * previous demo first. To remove it entirely:  pnpm db:seed-demo --clear
 *
 * Run after the normal seed:  pnpm --filter @nlr/dashboard db:seed-demo
 */
import { eq, like } from "drizzle-orm";

import { getDb, schema } from "./client";
import { newId } from "../lib/id";
import { sydneyToday } from "../lib/sydney";

const H = 36e5;
const ago = (h: number) => new Date(Date.now() - h * H);

// [repId, count, type] — counts chosen to show every tier.
const DEMO_BOOKINGS: Array<[string, number, "moving" | "storage" | "cleaning" | "car"]> = [
  ["harry", 8, "moving"], // goal 8 → HIT 🎉
  ["max", 9, "moving"], // goal 4 → WILD 🐐 ("slow down lol")
  ["mariam", 6, "storage"], // goal 5 → OVER 🔥
  ["hadeel", 4, "cleaning"], // goal 5 → ALMOST
  ["nisreen", 5, "moving"], // goal 8 → progress
  ["francis", 3, "car"], // progress
  ["ann", 3, "moving"], // progress
  ["andy", 1, "storage"], // progress
  ["jenifer", 2, "moving"],
];

// [repId, events] — drives clock status + allocator eligibility.
const DEMO_CLOCK: Array<[string, Array<["in" | "break_start" | "break_end" | "out", number]>]> = [
  ["andy", [["in", 3]]], // ON
  ["harry", [["in", 4]]], // ON
  ["mariam", [["in", 2]]], // ON
  ["nisreen", [["in", 5], ["break_start", 0.2]]], // BREAK → no leads
  ["max", [["in", 6], ["out", 0.2]]], // DONE
];

// [repId, leadsToday] — Andy ahead, Mariam owed the next.
const DEMO_LEADS: Array<[string, number]> = [
  ["andy", 2],
  ["harry", 1],
];

const SUBURBS = [
  ["Parramatta NSW", "Newcastle NSW"],
  ["Bondi NSW", "Melbourne VIC"],
  ["Penrith NSW", "Brisbane QLD"],
  ["Liverpool NSW", "Canberra ACT"],
  ["Mascot NSW", "Wollongong NSW"],
];

async function clearDemo() {
  const db = await getDb();
  await db.delete(schema.bookings).where(like(schema.bookings.jobNumber, "DEMO-%"));
  await db.delete(schema.clockEvents).where(eq(schema.clockEvents.source, "demo"));
  await db.delete(schema.leads).where(eq(schema.leads.source, "demo"));
}

async function run() {
  const clearOnly = process.argv.includes("--clear");
  await clearDemo();
  if (clearOnly) {
    console.warn("Demo data cleared.");
    return;
  }

  const db = await getDb();
  const today = sydneyToday();
  let n = 0;

  for (const [rep, count, type] of DEMO_BOOKINGS) {
    for (let i = 0; i < count; i++) {
      const [pickup, delivery] = SUBURBS[n % SUBURBS.length]!;
      n += 1;
      await db.insert(schema.bookings).values({
        id: newId(),
        jobNumber: `DEMO-${String(n).padStart(3, "0")}`,
        type,
        status: "booked",
        customerName: ["Sherae", "Leah", "Glen", "Sophie", "Tom", "Priya"][n % 6],
        pickup,
        delivery,
        state: "NSW",
        moveDate: today,
        value: String(1200 + (n % 5) * 350),
        deposit: "200",
        salesRepId: rep,
        createdBy: rep,
      });
    }
  }

  for (const [rep, events] of DEMO_CLOCK) {
    for (const [kind, h] of events) {
      await db.insert(schema.clockEvents).values({
        id: newId(),
        staffId: rep,
        kind,
        at: ago(h),
        source: "demo",
      });
    }
  }

  for (const [rep, leads] of DEMO_LEADS) {
    for (let i = 0; i < leads; i++) {
      await db.insert(schema.leads).values({ id: newId(), staffId: rep, source: "demo" });
    }
  }

  console.warn(`Demo day seeded: ${n} bookings, clock states, leads. Clear with --clear.`);
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
