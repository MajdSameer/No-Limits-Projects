"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

import { logAudit } from "../../db/audit";
import { getDb, schema } from "../../db/client";
import { shiftOverrideKey } from "../../db/queries/boards";
import { getSetting, setSetting } from "../../db/settings";
import { hashPin, validPinFormat } from "../../lib/auth-core";
import { newId } from "../../lib/id";
import { notify } from "../../lib/notify";
import { requireManager } from "../../lib/session";
import { sydneyToday } from "../../lib/sydney";

export interface ActionState {
  error?: string;
}

function slugify(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export async function addStaff(name: string, role: "rep" | "manager"): Promise<ActionState> {
  const manager = await requireManager();
  const clean = name.trim();
  if (clean.length < 2) return { error: "Name too short." };
  const id = slugify(clean);
  if (!id) return { error: "Name needs letters or digits." };

  const db = await getDb();
  const [existing] = await db.select().from(schema.staff).where(eq(schema.staff.id, id));
  if (existing) return { error: `"${id}" already exists.` };

  await db.insert(schema.staff).values({
    id,
    name: clean,
    role,
    pinHash: hashPin(role === "manager" ? "123456" : "1234"),
  });
  await logAudit({ staffId: manager.staffId, action: "staff.add", entity: "staff", entityId: id, diff: { name: clean, role } });
  notify("staff");
  revalidatePath("/manage");
  return {};
}

export async function setPin(staffId: string, pin: string): Promise<ActionState> {
  const manager = await requireManager();
  if (!validPinFormat(pin)) return { error: "PIN must be 4–6 digits." };
  const db = await getDb();
  await db
    .update(schema.staff)
    .set({ pinHash: hashPin(pin), failedAttempts: 0, lockedAt: null })
    .where(eq(schema.staff.id, staffId));
  await logAudit({ staffId: manager.staffId, action: "staff.set_pin", entity: "staff", entityId: staffId });
  revalidatePath("/manage");
  return {};
}

export async function unlockStaff(staffId: string): Promise<ActionState> {
  const manager = await requireManager();
  const db = await getDb();
  await db
    .update(schema.staff)
    .set({ failedAttempts: 0, lockedAt: null })
    .where(eq(schema.staff.id, staffId));
  await logAudit({ staffId: manager.staffId, action: "staff.unlock", entity: "staff", entityId: staffId });
  notify("staff");
  revalidatePath("/manage");
  return {};
}

export async function setActive(staffId: string, active: boolean): Promise<ActionState> {
  const manager = await requireManager();
  const db = await getDb();
  await db.update(schema.staff).set({ active }).where(eq(schema.staff.id, staffId));
  await logAudit({
    staffId: manager.staffId,
    action: active ? "staff.reactivate" : "staff.deactivate",
    entity: "staff",
    entityId: staffId,
  });
  notify("staff");
  revalidatePath("/manage");
  return {};
}

export async function setGoal(staffId: string, dailyTarget: number): Promise<ActionState> {
  const manager = await requireManager();
  if (!Number.isInteger(dailyTarget) || dailyTarget < 0 || dailyTarget > 50) {
    return { error: "Goal must be 0–50." };
  }
  const db = await getDb();
  await db.insert(schema.goals).values({
    id: newId(),
    staffId,
    dailyTarget,
    effectiveFrom: sydneyToday(),
  });
  await logAudit({
    staffId: manager.staffId,
    action: "staff.set_goal",
    entity: "goals",
    entityId: staffId,
    diff: { dailyTarget },
  });
  notify("bookings"); // boards show goals
  revalidatePath("/manage");
  return {};
}

export async function setIntakeWeight(staffId: string, weight: number): Promise<ActionState> {
  const manager = await requireManager();
  if (Number.isNaN(weight) || weight < 0 || weight > 3) return { error: "Weight must be 0–3." };
  const db = await getDb();
  await db
    .update(schema.staff)
    .set({ intakeWeight: String(weight) })
    .where(eq(schema.staff.id, staffId));
  await logAudit({
    staffId: manager.staffId,
    action: "staff.set_intake_weight",
    entity: "staff",
    entityId: staffId,
    diff: { weight },
  });
  revalidatePath("/manage");
  notify("bookings");
  return {};
}

export async function setGender(staffId: string, gender: "f" | "m" | "x"): Promise<ActionState> {
  const manager = await requireManager();
  if (!["f", "m", "x"].includes(gender)) return { error: "Bad value." };
  const db = await getDb();
  await db.update(schema.staff).set({ gender }).where(eq(schema.staff.id, staffId));
  await logAudit({ staffId: manager.staffId, action: "staff.set_gender", entity: "staff", entityId: staffId, diff: { gender } });
  revalidatePath("/manage");
  notify("bookings");
  return {};
}

export async function setTeam(staffId: string, team: "orange" | "blue" | null): Promise<ActionState> {
  const manager = await requireManager();
  if (team !== null && !["orange", "blue"].includes(team)) return { error: "Bad value." };
  const db = await getDb();
  await db.update(schema.staff).set({ team }).where(eq(schema.staff.id, staffId));
  await logAudit({ staffId: manager.staffId, action: "staff.set_team", entity: "staff", entityId: staffId, diff: { team } });
  revalidatePath("/manage");
  notify("bookings");
  return {};
}

/** Set the combined team monthly goal. Manager-only. */
export async function setMonthlyGoal(goal: number): Promise<ActionState> {
  const manager = await requireManager();
  if (!Number.isInteger(goal) || goal < 1 || goal > 100000) return { error: "Goal must be 1–100000." };
  await setSetting("monthly_goal", String(goal));
  await logAudit({ staffId: manager.staffId, action: "settings.monthly_goal", entity: "app_settings", entityId: "monthly_goal", diff: { goal } });
  notify("bookings");
  revalidatePath("/");
  revalidatePath("/manage");
  return {};
}

/**
 * Set whether a rep is on shift today, driving the live daily team target.
 * `onShift` true/false forces them on/off regardless of the sheet; `null` clears
 * the override so they follow the sheet's clock-in again. Resets daily (the
 * override is stored under a date-stamped key). Manager-only.
 */
export async function setOnShift(
  staffId: string,
  onShift: boolean | null,
): Promise<ActionState> {
  const manager = await requireManager();
  const key = shiftOverrideKey();
  const raw = await getSetting(key, "");
  let obj: Record<string, boolean> = {};
  if (raw) {
    try {
      obj = JSON.parse(raw) as Record<string, boolean>;
    } catch {
      obj = {};
    }
  }
  if (onShift === null) delete obj[staffId];
  else obj[staffId] = onShift;
  await setSetting(key, JSON.stringify(obj));
  await logAudit({
    staffId: manager.staffId,
    action: onShift === null ? "shift.clear" : onShift ? "shift.clock_in" : "shift.clock_out",
    entity: "app_settings",
    entityId: key,
    diff: { staffId, onShift },
  });
  notify("clock"); // clock indicators + roster
  notify("bookings"); // the live daily target depends on who's on shift
  revalidatePath("/manage");
  return {};
}

/**
 * Pick (or clear) the day's "top revenue job" prize winner for the Game Day
 * board. Per-job revenue isn't tracked in the pipeline, so a manager sets the
 * winning rep by hand; it's stored with today's date so it auto-clears tomorrow.
 * Pass null to clear. Manager-only.
 */
export async function setTopRevenueJob(staffId: string | null): Promise<ActionState> {
  const manager = await requireManager();
  if (staffId === null) {
    await setSetting("top_revenue_job", "");
  } else {
    const db = await getDb();
    const [rep] = await db.select().from(schema.staff).where(eq(schema.staff.id, staffId));
    if (!rep) return { error: "Unknown rep." };
    await setSetting(
      "top_revenue_job",
      JSON.stringify({ date: sydneyToday(), staffId: rep.id, name: rep.name }),
    );
  }
  await logAudit({
    staffId: manager.staffId,
    action: "settings.top_revenue_job",
    entity: "app_settings",
    entityId: "top_revenue_job",
    diff: { staffId },
  });
  notify("bookings"); // wall boards show the winner in the prize ribbon
  revalidatePath("/game-day");
  return {};
}

/** Flip Game Day mode for the whole floor. Manager-only. */
export async function setGameDay(on: boolean): Promise<ActionState> {
  const manager = await requireManager();
  await setSetting("game_day", on ? "on" : "off");
  await logAudit({ staffId: manager.staffId, action: "settings.game_day", entity: "app_settings", entityId: "game_day", diff: { on } });
  notify("bookings");
  notify("clock");
  revalidatePath("/");
  revalidatePath("/manage");
  return {};
}
