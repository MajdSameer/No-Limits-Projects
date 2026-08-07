import { desc } from "drizzle-orm";

import { getDb, schema } from "../client";
import { isGameDay } from "../settings";
import { dailyBoard, type BoardRow } from "./boards";
import { newId } from "../../lib/id";
import { sydneyToday } from "../../lib/sydney";

// Mirrors GameDayWall.tsx's own TOP_SCORER_PRIZE/TEAM_PRIZE constants —
// snapshotted onto each captured row (see schema.ts) rather than imported,
// since a UI component shouldn't be imported into a server-only query
// module; keep these two in sync by hand if the wall's prizes ever change.
const TOP_SCORER_PRIZE = 50;
const TEAM_PRIZE = 50;

export interface GameDayResultRow {
  staffId: string;
  name: string;
  team: "orange" | "blue";
  count: number;
}

export interface GameDayResult {
  date: string;
  orangeTotal: number;
  blueTotal: number;
  winner: "orange" | "blue" | null;
  topScorerIds: string[];
  reps: GameDayResultRow[];
  teamPrize: number;
  topScorerPrize: number;
  capturedAt: string;
}

export interface GameDayComputed {
  orangeTotal: number;
  blueTotal: number;
  winner: "orange" | "blue" | null;
  topScorerIds: string[];
  reps: GameDayResultRow[];
}

/**
 * Pure: team totals, winner (null on a tie), and the day's top scorer(s)
 * (ties all share it) from a board's rows — exactly mirrors GameDayWall.tsx's
 * own derived-state block, so a captured result always matches what the
 * wall was showing at the time. Reps with no team assignment are dropped,
 * same as the wall.
 */
export function computeGameDayResult(daily: BoardRow[]): GameDayComputed {
  const teamed = daily.filter(
    (r): r is BoardRow & { team: "orange" | "blue" } => r.team === "orange" || r.team === "blue",
  );
  const orangeTotal = teamed.filter((r) => r.team === "orange").reduce((s, r) => s + r.count, 0);
  const blueTotal = teamed.filter((r) => r.team === "blue").reduce((s, r) => s + r.count, 0);
  const winner: "orange" | "blue" | null =
    orangeTotal === blueTotal ? null : orangeTotal > blueTotal ? "orange" : "blue";

  const maxCount = teamed.reduce((m, r) => Math.max(m, r.count), 0);
  const topScorerIds = teamed.filter((r) => r.count > 0 && r.count === maxCount).map((r) => r.staffId);

  const reps: GameDayResultRow[] = teamed.map((r) => ({
    staffId: r.staffId,
    name: r.name,
    team: r.team,
    count: r.count,
  }));

  return { orangeTotal, blueTotal, winner, topScorerIds, reps };
}

/**
 * Captures today's Game Day result IF game_day mode is currently on, off
 * the same dailyBoard() source the wall itself reads (see
 * computeGameDayResult). Upserts on date, so re-running for the same day
 * (e.g. a retried cron) updates in place rather than duplicating. Returns
 * null (nothing captured) when game_day is off — most days aren't Game Day,
 * and this is meant to be called by a cron that runs every day regardless.
 */
export async function captureGameDayResult(now: Date = new Date()): Promise<GameDayResult | null> {
  if (!(await isGameDay())) return null;

  const daily = await dailyBoard(now);
  const { orangeTotal, blueTotal, winner, topScorerIds, reps } = computeGameDayResult(daily);

  const date = sydneyToday(now);
  const db = await getDb();
  const [row] = await db
    .insert(schema.gameDayResults)
    .values({
      id: newId(),
      date,
      orangeTotal,
      blueTotal,
      winner,
      topScorerIds,
      reps,
      teamPrize: TEAM_PRIZE,
      topScorerPrize: TOP_SCORER_PRIZE,
    })
    .onConflictDoUpdate({
      target: schema.gameDayResults.date,
      set: { orangeTotal, blueTotal, winner, topScorerIds, reps, teamPrize: TEAM_PRIZE, topScorerPrize: TOP_SCORER_PRIZE },
    })
    .returning();

  return toResult(row!);
}

/** All captured Game Day results, most recent first. */
export async function listGameDayResults(): Promise<GameDayResult[]> {
  const db = await getDb();
  const rows = await db.select().from(schema.gameDayResults).orderBy(desc(schema.gameDayResults.date));
  return rows.map(toResult);
}

function toResult(row: typeof schema.gameDayResults.$inferSelect): GameDayResult {
  return {
    date: row.date,
    orangeTotal: row.orangeTotal,
    blueTotal: row.blueTotal,
    winner: row.winner,
    topScorerIds: row.topScorerIds,
    reps: row.reps,
    teamPrize: row.teamPrize,
    topScorerPrize: row.topScorerPrize,
    capturedAt: row.capturedAt.toISOString(),
  };
}
