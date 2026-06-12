/**
 * PIN verification + lockout, separated from the server action so it can be
 * unit-tested against PGlite without Next's cookies()/redirect machinery.
 * Policy: 5 wrong PINs locks the account until a manager unlocks it.
 */
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

import type { Db } from "../db/client";
import { schema } from "../db/client";

export const MAX_PIN_ATTEMPTS = 5;

export type VerifyResult =
  | { ok: true; staff: { id: string; name: string; role: "rep" | "manager" } }
  | { ok: false; reason: "unknown" | "inactive" | "locked" | "wrong-pin" };

export async function verifyPin(db: Db, staffId: string, pin: string): Promise<VerifyResult> {
  const [row] = await db.select().from(schema.staff).where(eq(schema.staff.id, staffId));
  if (!row) return { ok: false, reason: "unknown" };
  if (!row.active) return { ok: false, reason: "inactive" };
  if (row.lockedAt) return { ok: false, reason: "locked" };

  const match = await bcrypt.compare(pin, row.pinHash);
  if (!match) {
    const attempts = row.failedAttempts + 1;
    await db
      .update(schema.staff)
      .set({
        failedAttempts: attempts,
        lockedAt: attempts >= MAX_PIN_ATTEMPTS ? new Date() : null,
      })
      .where(eq(schema.staff.id, staffId));
    return { ok: false, reason: attempts >= MAX_PIN_ATTEMPTS ? "locked" : "wrong-pin" };
  }

  await db
    .update(schema.staff)
    .set({ failedAttempts: 0, lockedAt: null })
    .where(eq(schema.staff.id, staffId));
  return { ok: true, staff: { id: row.id, name: row.name, role: row.role } };
}

export function hashPin(pin: string): string {
  return bcrypt.hashSync(pin, 10);
}

export function validPinFormat(pin: string): boolean {
  return /^\d{4,6}$/.test(pin);
}
