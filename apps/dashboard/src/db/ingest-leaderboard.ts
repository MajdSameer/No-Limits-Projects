/**
 * Ingest a "Leaderboard" snapshot pushed by the spreadsheet's Apps Script
 * (see api/ingest/leaderboard and scripts/sheets/leaderboard.gs). The sheet is
 * the source of truth; each push overwrites the live mirror.
 *
 * Per rep it: upserts identity + intake weight (staff), today's goal (goals),
 * and the volatile floor numbers — today's booking count, job codes and clock
 * fields (rep_live). It NEVER changes PINs, roles, gender or Game-Day team.
 */
import { and, eq } from "drizzle-orm";

import { hashPin } from "../lib/auth-core";
import { newId } from "../lib/id";
import { slug } from "../lib/slug";
import { sydneyToday } from "../lib/sydney";
import { schema, type Db } from "./client";

/** One rep row from the Apps Script payload. Only `name` is required. */
export interface LeaderboardRow {
  name: string;
  intakeWeight?: number | string | null;
  dailyTarget?: number | null;
  bookingsToday?: number | null;
  jobCodes?: string[] | null;
  timeIn?: string | null;
  breakStart?: string | null;
  breakEnd?: string | null;
  timeOut?: string | null;
  workingHours?: string | null;
}

export interface IngestResult {
  total: number;
  added: string[];
  rosterUpdated: string[];
}

function cleanStr(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

export async function ingestLeaderboard(
  db: Db,
  rows: LeaderboardRow[],
  asOfDate: string = sydneyToday(),
): Promise<IngestResult> {
  const result: IngestResult = { total: 0, added: [], rosterUpdated: [] };

  for (const row of rows) {
    const name = cleanStr(row.name);
    if (!name) continue;
    const id = slug(name);
    if (!id) continue;
    result.total += 1;

    const weight = row.intakeWeight == null ? null : Number(row.intakeWeight);
    const hasWeight = weight !== null && Number.isFinite(weight) && weight > 0;

    // ── staff: identity + intake weight ──────────────────────────────────
    const [existing] = await db
      .select({ name: schema.staff.name, intakeWeight: schema.staff.intakeWeight })
      .from(schema.staff)
      .where(eq(schema.staff.id, id))
      .limit(1);

    if (!existing) {
      await db.insert(schema.staff).values({
        id,
        name,
        pinHash: hashPin("1234"), // rotate in /manage
        ...(hasWeight ? { intakeWeight: String(weight) } : {}),
      });
      result.added.push(id);
    } else {
      const nameChanged = existing.name !== name;
      const weightChanged = hasWeight && Number(existing.intakeWeight) !== weight;
      if (nameChanged || weightChanged) {
        await db
          .update(schema.staff)
          .set({ name, ...(hasWeight ? { intakeWeight: String(weight) } : {}) })
          .where(eq(schema.staff.id, id));
        result.rosterUpdated.push(id);
      }
    }

    // ── goal for today (optional) ────────────────────────────────────────
    if (row.dailyTarget != null && Number.isFinite(Number(row.dailyTarget))) {
      const target = Math.round(Number(row.dailyTarget));
      const [goal] = await db
        .select({ id: schema.goals.id, dailyTarget: schema.goals.dailyTarget })
        .from(schema.goals)
        .where(and(eq(schema.goals.staffId, id), eq(schema.goals.effectiveFrom, asOfDate)))
        .limit(1);
      if (!goal) {
        await db
          .insert(schema.goals)
          .values({ id: newId(), staffId: id, dailyTarget: target, effectiveFrom: asOfDate });
      } else if (goal.dailyTarget !== target) {
        await db
          .update(schema.goals)
          .set({ dailyTarget: target })
          .where(eq(schema.goals.id, goal.id));
      }
    }

    // ── live snapshot (counts + clock) ───────────────────────────────────
    const jobCodes = Array.isArray(row.jobCodes)
      ? row.jobCodes.map((c) => String(c).trim()).filter(Boolean)
      : null;
    const live = {
      bookingsToday: Math.max(0, Math.round(Number(row.bookingsToday) || 0)),
      jobCodes,
      timeIn: cleanStr(row.timeIn),
      breakStart: cleanStr(row.breakStart),
      breakEnd: cleanStr(row.breakEnd),
      timeOut: cleanStr(row.timeOut),
      workingHours: cleanStr(row.workingHours),
      asOfDate,
    };
    await db
      .insert(schema.repLive)
      .values({ staffId: id, ...live })
      .onConflictDoUpdate({
        target: schema.repLive.staffId,
        set: { ...live, updatedAt: new Date() },
      });
  }

  return result;
}
