import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

export interface Session {
  staffId: string;
  name: string;
  role: "rep" | "manager";
}

export const SESSION_COOKIE = "nl_session";

function secret(): Uint8Array {
  return new TextEncoder().encode(process.env.SESSION_SECRET ?? "dev-secret-change-me");
}

export async function createSession(s: Session): Promise<void> {
  const jwt = await new SignJWT({ staffId: s.staffId, name: s.name, role: s.role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(secret());
  (await cookies()).set(SESSION_COOKIE, jwt, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 12 * 60 * 60,
  });
}

export async function getSession(): Promise<Session | null> {
  const jwt = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!jwt) return null;
  try {
    const { payload } = await jwtVerify(jwt, secret());
    if (typeof payload.staffId !== "string" || typeof payload.role !== "string") return null;
    return {
      staffId: payload.staffId,
      name: String(payload.name ?? payload.staffId),
      role: payload.role === "manager" ? "manager" : "rep",
    };
  } catch {
    return null;
  }
}

export async function destroySession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function requireSession(): Promise<Session> {
  const s = await getSession();
  if (!s) throw new Error("UNAUTHENTICATED");
  return s;
}

export async function requireManager(): Promise<Session> {
  const s = await requireSession();
  if (s.role !== "manager") throw new Error("FORBIDDEN");
  return s;
}
