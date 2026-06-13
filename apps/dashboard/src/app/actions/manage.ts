"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

import { logAudit } from "../../db/audit";
import { getDb, schema } from "../../db/client";
import { setSetting } from "../../db/settings";
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
