"use server";

import { redirect } from "next/navigation";

import { getDb } from "../../db/client";
import { logAudit } from "../../db/audit";
import { verifyPin } from "../../lib/auth-core";
import { createSession, destroySession, getSession } from "../../lib/session";

export interface SignInState {
  error?: "wrong-pin" | "locked" | "unavailable";
}

export async function signIn(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const staffId = String(formData.get("staffId") ?? "");
  const pin = String(formData.get("pin") ?? "");
  const db = await getDb();

  const result = await verifyPin(db, staffId, pin);
  if (!result.ok) {
    if (result.reason === "locked") return { error: "locked" };
    if (result.reason === "wrong-pin") return { error: "wrong-pin" };
    return { error: "unavailable" };
  }

  await createSession({ staffId: result.staff.id, name: result.staff.name, role: result.staff.role });
  await logAudit({
    staffId: result.staff.id,
    action: "auth.sign_in",
    entity: "staff",
    entityId: result.staff.id,
  });
  // Greeting flag — the board reads it then strips the param client-side.
  redirect("/?welcome=1");
}

export async function signOut(): Promise<void> {
  const s = await getSession();
  if (s) {
    await logAudit({ staffId: s.staffId, action: "auth.sign_out", entity: "staff", entityId: s.staffId });
  }
  await destroySession();
  redirect("/sign-in");
}
