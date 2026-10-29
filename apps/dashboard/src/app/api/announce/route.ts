import { NextResponse, type NextRequest } from "next/server";

import { addAnnouncement, announcementsAfter, latestAnnouncementKey } from "../../../db/announcements";
import { getDb, schema } from "../../../db/client";
import { parseAnnounceBody } from "../../../lib/announce";
import { notify } from "../../../lib/notify";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

// ── Light abuse guard ────────────────────────────────────────────────────
// The /booked link is public (no login) and every accepted submission makes
// the wall TV gong, so cap submissions per IP. In-memory is fine: it only has
// to blunt a stuck button / a bored person, not a determined attacker.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 12;
const hits = new Map<string, number[]>();

function rateLimited(ip: string, now = Date.now()): boolean {
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 500) for (const [k, v] of hits) if (v.every((t) => now - t >= WINDOW_MS)) hits.delete(k);
  return recent.length > MAX_PER_WINDOW;
}

/** Use the rep's exact spelling from the roster when the typed/picked name matches one. */
async function canonicalRepName(name: string): Promise<string> {
  try {
    const db = await getDb();
    const rows = await db.select({ name: schema.staff.name }).from(schema.staff);
    return rows.find((r) => r.name.toLowerCase() === name.toLowerCase())?.name ?? name;
  } catch {
    return name;
  }
}

/**
 * POST — the /booked form. Stores the announcement and pings the walls so the
 * celebration shows within a second or two. Public by design (no login), guarded
 * by validation, a honeypot field, a per-IP rate limit, and a 2-minute dedupe on
 * the job number.
 */
export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (rateLimited(ip)) {
    return NextResponse.json({ ok: false, error: "Too many submissions — wait a minute and try again." }, { status: 429 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }
  // Honeypot: real people never fill the hidden field; bots do. Pretend success.
  if (typeof (body as { company?: unknown })?.company === "string" && (body as { company: string }).company.trim()) {
    return NextResponse.json({ ok: true });
  }
  const parsed = parseAnnounceBody(body);
  if (!parsed.ok) return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });

  try {
    // Store both names in the roster's exact spelling so the /live tracker counts them exactly.
    const [forRep, by] = await Promise.all([canonicalRepName(parsed.value.forRep), canonicalRepName(parsed.value.by)]);
    const { announcement, duplicate } = await addAnnouncement({ ...parsed.value, by, forRep });
    if (!duplicate) notify("announce"); // instant ping; screens also poll every second
    return NextResponse.json({ ok: true, duplicate, key: announcement.key });
  } catch (err) {
    console.error("POST /api/announce failed:", err);
    return NextResponse.json({ ok: false, error: "Could not send — please try again." }, { status: 500 });
  }
}

/**
 * GET — polled by the wall. Without `after` it just returns the current cursor
 * (so a freshly-loaded screen never replays old announcements); with `after` it
 * returns anything newer, oldest first.
 */
export async function GET(request: NextRequest) {
  const after = request.nextUrl.searchParams.get("after");
  try {
    if (!after) {
      return NextResponse.json({ items: [], cursor: await latestAnnouncementKey() }, { headers: { "cache-control": "no-store" } });
    }
    const items = await announcementsAfter(after);
    return NextResponse.json(
      { items, cursor: items.length ? items[items.length - 1]!.key : after },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (err) {
    console.error("GET /api/announce failed:", err);
    return NextResponse.json({ items: [], cursor: after ?? null }, { status: 200, headers: { "cache-control": "no-store" } });
  }
}
