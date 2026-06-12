# No Limits Ops (staff dashboard) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `apps/dashboard` — bookings + leaderboards + clock + roster + TV replacing the Google Sheets floor OS, per `docs/superpowers/specs/2026-06-12-staff-dashboard-design.md`.

**Architecture:** Next.js 15 App Router app in the monorepo; Drizzle ORM over PGlite (dev/test, zero setup, offline) or Supabase Postgres (prod, `DATABASE_URL`); all mutations via server actions guarded by a jose-signed PIN session cookie; realtime = Supabase broadcast *pings* (no row data) + an always-on 3 s poll fallback; Sydney-timezone day/month bucketing everywhere.

**Tech Stack:** drizzle-orm + drizzle-kit, @electric-sql/pglite, postgres (postgres-js), bcryptjs, jose, @supabase/supabase-js (broadcast only), date-fns + date-fns-tz, vitest, canvas-confetti, Playwright (already available), @nlr/config + @nlr/ui.

**Conventions that bind every task:** TS strict; tokens only (no raw brand hexes); a11y floor (44 px targets, focus-visible, labels, reduced-motion); `pnpm check` green before every commit; timezone = `Australia/Sydney`; all timestamps stored UTC.

**Env contract (documented in `apps/dashboard/.env.example`, set for prod in Vercel):**

```bash
# Server — Supabase pooler URL with the database password (prod only; PGlite used when absent)
DATABASE_URL="postgresql://postgres.hhbjkqtpfcqglwvwpmpx:<PASSWORD>@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres"
# Session signing secret (generate: openssl rand -base64 32)
SESSION_SECRET=""
# Realtime ping bus (safe to expose; omit entirely to run poll-only)
NEXT_PUBLIC_SUPABASE_URL="https://hhbjkqtpfcqglwvwpmpx.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="sb_publishable_QFlIv94jB-lxf2HB3Q2yXg_du1Yil_l"
```

Prod migrations: `pnpm --filter @nlr/dashboard db:sql` prints the migration SQL → owner pastes into Supabase SQL Editor (no password ever shared). Local-with-prod: `db:migrate` reads `DATABASE_URL`.

---

## Phase 1 — Foundation (app, schema, auth)

### Task 1: Scaffold the app

**Files:**
- Create: `apps/dashboard/` (via scaffold script), then strip marketing page
- Modify: `apps/dashboard/package.json` (name `@nlr/dashboard`, deps, scripts)

- [ ] **Step 1:** `pnpm new-app dashboard` → verify `apps/dashboard` exists.
- [ ] **Step 2:** Replace `src/app/page.tsx` with a placeholder server component rendering `<p>No Limits Ops</p>`; delete `QuoteCard.tsx`, `actions.ts`, `quote-options.ts`, `ManifestHeader.tsx` copies if scaffolded; keep `globals.css` (tokens + fonts) and `manifest-theme.css` import (ink/manila reused).
- [ ] **Step 3:** Add deps:

```bash
pnpm --filter @nlr/dashboard add drizzle-orm postgres @electric-sql/pglite bcryptjs jose date-fns date-fns-tz @supabase/supabase-js canvas-confetti
pnpm --filter @nlr/dashboard add -D drizzle-kit vitest @types/bcryptjs
```

- [ ] **Step 4:** Add scripts to `apps/dashboard/package.json`:

```json
"scripts": {
  "db:generate": "drizzle-kit generate",
  "db:migrate": "tsx src/db/migrate.ts",
  "db:sql": "cat src/db/migrations/*.sql",
  "db:seed": "tsx src/db/seed.ts",
  "test": "vitest run"
}
```

(`tsx` dev-dep if not hoisted: `pnpm --filter @nlr/dashboard add -D tsx`.)
- [ ] **Step 5:** `pnpm check` → green. Commit: `feat(dashboard): scaffold No Limits Ops app`.

### Task 2: Schema + db client + migrations

**Files:**
- Create: `apps/dashboard/src/db/schema.ts`, `src/db/client.ts`, `src/db/migrate.ts`, `drizzle.config.ts`
- Test: `apps/dashboard/src/db/__tests__/schema.test.ts`

- [ ] **Step 1:** `schema.ts` — complete:

```ts
import {
  boolean, date, integer, jsonb, numeric, pgEnum, pgTable, text, time,
  timestamp, uniqueIndex,
} from "drizzle-orm/pg-core";

export const role = pgEnum("role", ["rep", "manager"]);
export const company = pgEnum("company", ["NL", "PM", "RRR"]);
export const bookingType = pgEnum("booking_type", ["moving", "storage", "cleaning", "car"]);
export const bookingStatus = pgEnum("booking_status", [
  "booked", "deposit", "confirmed", "completed", "cancelled", "refunded",
]);
export const clockKind = pgEnum("clock_kind", ["in", "break_start", "break_end", "out"]);

export const staff = pgTable("staff", {
  id: text("id").primaryKey(), // slug e.g. "andy"
  name: text("name").notNull(),
  role: role("role").notNull().default("rep"),
  pinHash: text("pin_hash").notNull(),
  intakeWeight: numeric("intake_weight").notNull().default("1.0"),
  active: boolean("active").notNull().default(true),
  failedAttempts: integer("failed_attempts").notNull().default(0),
  lockedAt: timestamp("locked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const bookings = pgTable("bookings", {
  id: text("id").primaryKey(), // nanoid
  jobNumber: text("job_number").notNull(),
  company: company("company").notNull().default("NL"),
  type: bookingType("type").notNull().default("moving"),
  status: bookingStatus("status").notNull().default("booked"),
  customerName: text("customer_name"),
  customerPhone: text("customer_phone"),
  customerEmail: text("customer_email"),
  pickup: text("pickup"),
  delivery: text("delivery"),
  state: text("state"),
  moveDate: date("move_date").notNull(),
  value: numeric("value"),
  deposit: numeric("deposit"),
  beds: integer("beds"),
  cubic: integer("cubic"),
  men: integer("men"),
  leadSource: text("lead_source"),
  notes: text("notes"),
  salesRepId: text("sales_rep_id").notNull().references(() => staff.id),
  enteredAt: timestamp("entered_at", { withTimezone: true }).notNull().defaultNow(),
  createdBy: text("created_by").notNull().references(() => staff.id),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (t) => [uniqueIndex("bookings_job_number_unique").on(t.jobNumber)]);

export const clockEvents = pgTable("clock_events", {
  id: text("id").primaryKey(),
  staffId: text("staff_id").notNull().references(() => staff.id),
  kind: clockKind("kind").notNull(),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  source: text("source").notNull().default("self"), // self|manager|system
  editedBy: text("edited_by"),
  note: text("note"),
});

export const shifts = pgTable("shifts", {
  id: text("id").primaryKey(),
  staffId: text("staff_id").notNull().references(() => staff.id),
  weekday: integer("weekday").notNull(), // 0=Mon … 6=Sun
  start: time("start").notNull(),
  end: time("end").notNull(),
  note: text("note"),
});

export const timeOff = pgTable("time_off", {
  id: text("id").primaryKey(),
  staffId: text("staff_id").notNull().references(() => staff.id),
  fromDate: date("from_date").notNull(),
  toDate: date("to_date").notNull(),
  reason: text("reason"),
});

export const goals = pgTable("goals", {
  id: text("id").primaryKey(),
  staffId: text("staff_id").notNull().references(() => staff.id),
  dailyTarget: integer("daily_target").notNull(),
  effectiveFrom: date("effective_from").notNull(),
});

export const auditLog = pgTable("audit_log", {
  id: text("id").primaryKey(),
  staffId: text("staff_id").notNull(),
  action: text("action").notNull(), // e.g. booking.create
  entity: text("entity").notNull(),
  entityId: text("entity_id").notNull(),
  diff: jsonb("diff"),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
});
```

- [ ] **Step 2:** `client.ts` — env-switched driver, singleton:

```ts
import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { PGlite } from "@electric-sql/pglite";
import postgres from "postgres";
import path from "node:path";
import * as schema from "./schema";

type DB = ReturnType<typeof drizzlePg<typeof schema>> | ReturnType<typeof drizzlePglite<typeof schema>>;
const globalForDb = globalThis as unknown as { __nlDb?: DB; __nlDbReady?: Promise<void> };

function create(): { db: DB; ready: Promise<void> } {
  if (process.env.DATABASE_URL) {
    const client = postgres(process.env.DATABASE_URL, { prepare: false }); // pooler-safe
    return { db: drizzlePg(client, { schema }), ready: Promise.resolve() };
  }
  const dataDir = process.env.PGLITE_DIR === ":memory:" ? undefined : path.join(process.cwd(), ".pglite");
  const pglite = new PGlite(dataDir);
  const db = drizzlePglite(pglite, { schema });
  const ready = migratePglite(db, { migrationsFolder: path.join(process.cwd(), "src/db/migrations") });
  return { db, ready };
}

const inst = globalForDb.__nlDb ? { db: globalForDb.__nlDb, ready: globalForDb.__nlDbReady! } : create();
globalForDb.__nlDb = inst.db; globalForDb.__nlDbReady = inst.ready;

export const db = inst.db;
/** Await before first query in dev/test (PGlite auto-migrates). */
export const dbReady = inst.ready;
export { schema };
```

- [ ] **Step 3:** `drizzle.config.ts` (out: `src/db/migrations`, dialect postgresql, schema path). Run `pnpm --filter @nlr/dashboard db:generate` → SQL file appears. `migrate.ts`: postgres-js migrator reading `DATABASE_URL` (for prod use).
- [ ] **Step 4:** Vitest test — PGlite in-memory: insert a staff row + booking, read back; duplicate `jobNumber` insert rejects:

```ts
import { beforeAll, expect, test } from "vitest";
process.env.PGLITE_DIR = ":memory:";
const { db, dbReady, schema } = await import("../client");

beforeAll(async () => { await dbReady; });

test("schema round-trip + unique job number", async () => {
  await db.insert(schema.staff).values({ id: "andy", name: "Andy", pinHash: "x" });
  await db.insert(schema.bookings).values({
    id: "b1", jobNumber: "98RRX", moveDate: "2026-07-01", salesRepId: "andy", createdBy: "andy",
  });
  const all = await db.select().from(schema.bookings);
  expect(all).toHaveLength(1);
  await expect(db.insert(schema.bookings).values({
    id: "b2", jobNumber: "98RRX", moveDate: "2026-07-02", salesRepId: "andy", createdBy: "andy",
  })).rejects.toThrow();
});
```

- [ ] **Step 5:** `pnpm --filter @nlr/dashboard test` → PASS; `pnpm check` → green. Commit: `feat(dashboard): drizzle schema, env-switched pglite/postgres client, migrations`.

### Task 3: Sydney time helpers (pure, golden-tested)

**Files:**
- Create: `apps/dashboard/src/lib/sydney.ts`
- Test: `apps/dashboard/src/lib/__tests__/sydney.test.ts`

- [ ] **Step 1:** Failing tests first — day boundary, month boundary, next-3-months window, DST edges (Sydney DST ends first Sunday of April, starts first Sunday of October):

```ts
import { describe, expect, test } from "vitest";
import { sydneyDayRange, sydneyMonthRange, next3MonthsDateRange, sydneyToday } from "../sydney";

test("day range crosses UTC midnight correctly", () => {
  // 2026-06-12 Sydney (AEST, UTC+10): day = 11T14:00Z .. 12T14:00Z
  const { start, end } = sydneyDayRange(new Date("2026-06-12T03:00:00Z"));
  expect(start.toISOString()).toBe("2026-06-11T14:00:00.000Z");
  expect(end.toISOString()).toBe("2026-06-12T14:00:00.000Z");
});
test("DST day is 25h on April rollback", () => {
  const { start, end } = sydneyDayRange(new Date("2026-04-05T01:00:00Z"));
  expect((end.getTime() - start.getTime()) / 36e5).toBe(25);
});
test("month range", () => {
  const { start, end } = sydneyMonthRange(new Date("2026-06-12T03:00:00Z"));
  expect(start.toISOString()).toBe("2026-05-31T14:00:00.000Z");
  expect(end.toISOString()).toBe("2026-06-30T14:00:00.000Z");
});
test("next 3 months date window (date strings for move_date)", () => {
  expect(next3MonthsDateRange(new Date("2026-06-12T03:00:00Z")))
    .toEqual({ from: "2026-06-12", to: "2026-09-12" });
});
```

- [ ] **Step 2:** Run → FAIL (module missing).
- [ ] **Step 3:** Implement with `date-fns-tz` (`toZonedTime`/`fromZonedTime`, `startOfDay`, `addDays/addMonths`, `formatInTimeZone` for date strings). `sydneyToday()` returns `yyyy-MM-dd` in Sydney. Yesterday = `sydneyDayRange(addDays(now, -1 Sydney))` — export `sydneyYesterdayRange` too.
- [ ] **Step 4:** Tests PASS. Commit: `feat(dashboard): sydney timezone bucketing helpers`.

### Task 4: PIN sessions + sign-in

**Files:**
- Create: `src/lib/session.ts`, `src/app/actions/auth.ts`, `src/app/sign-in/page.tsx`, `src/components/PinPad.tsx`, `src/middleware.ts` (at `apps/dashboard/src/`)
- Test: `src/lib/__tests__/session.test.ts`, `src/app/actions/__tests__/auth.test.ts`

- [ ] **Step 1:** `session.ts` — jose HS256 JWT in httpOnly cookie:

```ts
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

export interface Session { staffId: string; name: string; role: "rep" | "manager" }
const COOKIE = "nl_session";
const secret = () => new TextEncoder().encode(process.env.SESSION_SECRET ?? "dev-secret-change-me");

export async function createSession(s: Session) {
  const jwt = await new SignJWT({ ...s }).setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("12h").sign(secret());
  (await cookies()).set(COOKIE, jwt, { httpOnly: true, sameSite: "lax", secure: true, path: "/" });
}
export async function getSession(): Promise<Session | null> {
  const jwt = (await cookies()).get(COOKIE)?.value;
  if (!jwt) return null;
  try { const { payload } = await jwtVerify(jwt, secret()); return payload as unknown as Session; }
  catch { return null; }
}
export async function destroySession() { (await cookies()).delete(COOKIE); }
export async function requireSession(): Promise<Session> {
  const s = await getSession(); if (!s) throw new Error("UNAUTHENTICATED"); return s;
}
export async function requireManager(): Promise<Session> {
  const s = await requireSession(); if (s.role !== "manager") throw new Error("FORBIDDEN"); return s;
}
```

- [ ] **Step 2:** `actions/auth.ts` — `signIn(staffId, pin)` server action: load active staff; if `lockedAt` set → `{ error: "locked" }`; bcrypt.compare; on fail increment `failedAttempts`, set `lockedAt` at 5; on success reset counter, `createSession`, audit `auth.sign_in`, redirect `/`. `signOut()` destroys + redirects. Unit-test lockout against PGlite (5 wrong PINs → locked even with correct PIN; manager unlock resets).
- [ ] **Step 3:** `middleware.ts` — redirect to `/sign-in` when no session cookie on app routes; allow `/sign-in`, `/tv`, `_next`, favicon. (TV is read-only and chromeless; it fetches via a public, data-minimal board endpoint — see Task 10.)
- [ ] **Step 4:** Sign-in UI: staff grid (server component lists active staff alphabetically, big 72 px tiles, initials avatar) → PinPad client component (digit buttons + masked display + submit; ≥44 px keys; error + locked states inline).
- [ ] **Step 5:** Tests + `pnpm check` green. Commit: `feat(dashboard): PIN auth with lockout, session cookie, sign-in screen`.

### Task 5: Seed + audit helper + app chrome

**Files:**
- Create: `src/db/seed.ts`, `src/db/audit.ts`, `src/components/AppShell.tsx`, `src/lib/id.ts`
- Modify: `src/app/layout.tsx`, `src/app/page.tsx`

- [ ] **Step 1:** `id.ts`: `export const newId = () => crypto.randomUUID().replace(/-/g, "").slice(0, 20);`
- [ ] **Step 2:** `audit.ts`: `logAudit(db, { staffId, action, entity, entityId, diff })` inserting `auditLog` row (never throws — wraps in try/catch + console.error).
- [ ] **Step 3:** `seed.ts` — the real floor, from the decoded sheet (goals = col C, weights = col A):

```ts
const REPS: Array<[id: string, name: string, weight: string, goal: number]> = [
  ["andy", "Andy", "1.1", 7], ["ann", "Ann", "0.9", 6], ["anthony", "Anthony", "0.5", 3],
  ["emilia", "Emilia", "0.7", 3], ["francis", "Francis", "1.1", 7], ["hadeel", "Hadeel", "1.1", 5],
  ["hanna", "Hanna", "0.7", 5], ["harry", "Harry", "1.1", 8], ["hermez", "Hermez", "1.0", 8],
  ["issac", "Issac", "1.1", 3], ["jenifer", "Jenifer", "1.1", 8], ["jessica", "Jessica", "1.1", 5],
  ["mariam", "Mariam", "0.8", 5], ["max", "Max", "1.1", 4], ["nisreen", "Nisreen", "1.1", 8],
  ["randee", "Randee", "1.1", 8],
];
// + manager account ["manager", "Manager", "1.0", 0] with role manager.
// Default PIN "1234" (reps) / "123456" (manager), bcrypt-hashed; CHANGE ON DAY ONE via /manage.
```

Idempotent (upsert by id). Run `pnpm --filter @nlr/dashboard db:seed` against PGlite → verify with a quick select.
- [ ] **Step 4:** `AppShell` (server): ink-ground layout, header (NO LIMITS OPS stencil lockup, nav: Board / Bookings / Roster / + Manage when manager, sign-out), slot for clock bar + quick-add button (wired in later tasks; render placeholders now). `layout.tsx` uses it except for `/sign-in` and `/tv` (route groups: `(app)` with shell, `(bare)` without — move pages accordingly).
- [ ] **Step 5:** `pnpm check` + manual `pnpm --filter @nlr/dashboard dev` sanity. Commit: `feat(dashboard): seed real floor, audit helper, app shell with route groups`.

## Phase 2 — Clock

### Task 6: Clock state machine (pure) + actions + bar

**Files:**
- Create: `src/lib/clock.ts`, `src/app/actions/clock.ts`, `src/components/ClockBar.tsx`
- Test: `src/lib/__tests__/clock.test.ts`

- [ ] **Step 1:** Failing tests for the machine — mirrors the sheet's J-column semantics:

```ts
import { deriveClock, nextActions } from "../clock";
// events = today's clock_events sorted by at
test("fresh day", () => {
  const s = deriveClock([], NOW);
  expect(s.status).toBe("off");
  expect(nextActions([])).toEqual(["in"]);
});
test("clocked in accumulates live", () => {
  const s = deriveClock([ev("in", "08:00")], at("10:30"));
  expect(s.status).toBe("on");
  expect(s.workedMs).toBe(2.5 * 36e5);
  expect(nextActions([ev("in", "08:00")])).toEqual(["break_start", "out"]);
});
test("break pauses work", () => {
  const evs = [ev("in", "08:00"), ev("break_start", "12:00")];
  const s = deriveClock(evs, at("12:30"));
  expect(s.status).toBe("break");
  expect(s.workedMs).toBe(4 * 36e5);
  expect(nextActions(evs)).toEqual(["break_end", "out"]);
});
test("full day", () => {
  const evs = [ev("in","08:00"), ev("break_start","12:00"), ev("break_end","13:00"), ev("out","17:00")];
  const s = deriveClock(evs, at("18:00"));
  expect(s.status).toBe("done");
  expect(s.workedMs).toBe(8 * 36e5);
});
test("invalid transitions rejected", () => {
  expect(nextActions([ev("out", "17:00")])).toEqual([]);
  expect(() => assertTransition([ev("in","08:00")], "break_end")).toThrow();
});
```

- [ ] **Step 2:** FAIL → implement `deriveClock(events, now)` → `{ status: "off"|"on"|"break"|"done", since, workedMs, breakMs }`, `nextActions(events)`, `assertTransition(events, kind)`.
- [ ] **Step 3:** `actions/clock.ts`: `punch(kind)` — session required; load today's events (Sydney range); `assertTransition`; insert; audit `clock.punch`; `notify("clock")` (Task 10's bus, stub for now); revalidate. Manager `correctClock(staffId, kind, atISO, note)` with `source:"manager"`, audited.
- [ ] **Step 4:** `ClockBar` (client): fixed bottom strip (ink, gold top hairline) — status text ("ON since 8:02 · 2h 31m" ticking each minute client-side) + ONE primary action button (and secondary "Clock out" while on break). Buttons call `punch` with optimistic transition + error toast on reject.
- [ ] **Step 5:** Tests pass, check green, commit: `feat(dashboard): clock state machine, punch actions, persistent clock bar`.

### Task 7: Midnight auto-close + timesheet data

**Files:**
- Create: `src/app/api/cron/midnight/route.ts`, `src/db/queries/timesheet.ts`, `apps/dashboard/vercel.json`
- Test: `src/db/queries/__tests__/timesheet.test.ts`

- [ ] **Step 1:** `timesheet.ts`: `dayStates(dateRange)` (per-staff derived clock for a day) and `weekHours(staff, weekRange)` reusing `deriveClock`; flag `autoClosed` when an `out` has `source:"system"`, and `lateMins` = first `in` minus rostered `shifts.start` when a shift exists (soft flag only). Unit-test with crafted events incl. forgotten clock-out.
- [ ] **Step 2:** Cron route (GET, guarded by `CRON_SECRET` header check): for each staff with an open day (last event not `out` in yesterday's Sydney range) insert `out` at 23:59:59 Sydney `source:"system"`, audit `clock.auto_close`. `vercel.json`: `{"crons":[{"path":"/api/cron/midnight","schedule":"5 14 * * *"}]}` (14:05 UTC = 00:05 Sydney winter; runs are idempotent so DST drift is harmless — route recomputes against Sydney calendar).
- [ ] **Step 3:** Tests + check, commit: `feat(dashboard): timesheet queries and midnight auto-close cron`.

## Phase 3 — Bookings

### Task 8: Quick-add + bookings actions

**Files:**
- Create: `src/app/actions/bookings.ts`, `src/components/QuickAdd.tsx`
- Modify: `src/components/AppShell.tsx` (mount QuickAdd button)
- Test: `src/app/actions/__tests__/bookings.test.ts`

- [ ] **Step 1:** Failing tests: create with 3 fields succeeds + audits; duplicate jobNumber returns `{ error: { code: "duplicate", byName, atISO } }` (not a throw); rep editing someone else's booking → FORBIDDEN; manager editing anyone's → ok; soft delete manager-only.
- [ ] **Step 2:** `bookings.ts` server actions: `quickAdd({ jobNumber, type, moveDate, customerName?, pickup?, delivery?, value?, deposit? })` (trims/uppercases jobNumber, validates `moveDate` ≥ 2020-01-01, salesRep = session staff), `updateBooking(id, patch)` (permission: own or manager; field allowlist; audit diff), `softDelete(id)` (manager), `restore(id)` (manager). All call `notify("bookings")`.
- [ ] **Step 3:** `QuickAdd` (client): gold `+ Job` pill in header → dialog (native `<dialog>` or headless): row 1 jobNumber (autofocus, mono) · type segmented control (4 options) · moveDate (date input, defaults today+7); row 2 collapsed "More details" disclosure (customer, pickup, delivery, value, deposit). Submit → optimistic toast "98RRX on the board 🎉 — Complete details" (link), confetti burst (canvas-confetti, `motion-safe` gated), dialog closes, focus returns to trigger. Duplicate error renders inline with link to existing booking. Target ≤3 required inputs, Enter submits.
- [ ] **Step 4:** Tests + check, commit: `feat(dashboard): quick-add and booking mutations with audit + permissions`.

### Task 9: Bookings list + detail

**Files:**
- Create: `src/app/(app)/bookings/page.tsx`, `src/app/(app)/bookings/[id]/page.tsx`, `src/components/BookingsTable.tsx`, `src/components/CompletionMeter.tsx`, `src/db/queries/bookings.ts`

- [ ] **Step 1:** `queries/bookings.ts`: `searchBookings({ q, repId, range, incompleteOnly, mine })` (ilike on jobNumber/customer/suburbs; excludes deleted; newest first; limit 200) and `completion(booking)` — % of [customerName, customerPhone, pickup, delivery, value, deposit, leadSource, beds, cubic, men] filled.
- [ ] **Step 2:** List page: manila table on ink (Freight-Manifest styling), columns jobNumber (mono) / customer / route (pickup→delivery truncated) / rep / type chip / moveDate / value / completion meter; filter bar (Today · This week · Incomplete · Mine · All) as links (searchParams), search input (GET form). Row → detail.
- [ ] **Step 3:** Detail page: sections Customer / Move / Money / Notes as definition grids; inline edit via per-section server-action forms when permitted (own/manager) else read-only with lock note; audit trail footer (last 10 audit rows for entity); soft-delete/restore buttons (manager); "Entered by X · counted {Sydney date}" header.
- [ ] **Step 4:** Playwright: sign in as Andy (PIN 1234) → quick-add `TEST1` → appears in list → open detail → edit customer name → audit row appears. Run with PGlite dev server. Commit: `feat(dashboard): bookings list, detail, completion meter, audit trail`.

## Phase 4 — Boards + live

### Task 10: Board queries + live bus

**Files:**
- Create: `src/db/queries/boards.ts`, `src/lib/live.ts`, `src/app/api/boards/route.ts`
- Test: `src/db/queries/__tests__/boards.test.ts`

- [ ] **Step 1:** Failing tests (PGlite, seeded staff, crafted `enteredAt`/`moveDate` rows): daily counts only Sydney-today entries; monthly counts calendar month; pipeline counts move_date in [today, +3mo); yesterday window; goals joined; per-type filter; deleted excluded.
- [ ] **Step 2:** `boards.ts`: `dailyBoard(now)`, `monthlyBoard(now)`, `pipelineBoard(now)`, `yesterdayBoard(now)` → `Array<{ staffId, name, count, goal? }>` sorted desc, count via SQL `count(*) filter` between ranges from Task 3 helpers.
- [ ] **Step 3:** `live.ts`:

```ts
"use client";
import { useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

/** Refetch on broadcast ping (if Supabase env present) + every 3s regardless. */
export function useLiveRefresh(scopes: string[], refetch: () => void) {
  const cb = useRef(refetch); cb.current = refetch;
  useEffect(() => {
    const interval = setInterval(() => cb.current(), 3000);
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return () => clearInterval(interval);
    const client = createClient(url, key);
    const ch = client.channel("nl-ops");
    ch.on("broadcast", { event: "changed" }, (m) => {
      if (scopes.includes(String(m.payload?.scope))) cb.current();
    }).subscribe();
    return () => { clearInterval(interval); client.removeChannel(ch); };
  }, [scopes.join(",")]);
}
```

Server-side `notify(scope)` in `src/lib/notify.ts`: fire-and-forget `channel.send({ type:"broadcast", event:"changed", payload:{ scope } })` when env present, try/catch, never blocks the action.
- [ ] **Step 3b:** `/api/boards` route (GET): returns all four boards as JSON. **Data-minimal by design** (first names, counts, goals only — no customer data) and used by both the Board page refetches and the public TV.
- [ ] **Step 4:** Tests + check, commit: `feat(dashboard): board aggregations, live ping bus with 3s poll fallback`.

### Task 11: Board page (landing)

**Files:**
- Create: `src/app/(app)/(board)/page.tsx`, `src/components/Board.tsx`, `src/components/RepCard.tsx`

- [ ] **Step 1:** `Board` (client): tabs Daily · Monthly · Next 3 Months (+ "Yesterday" toggle on Daily), data via `/api/boards` with `useLiveRefresh(["bookings"], refetch)`. Daily = grid of `RepCard`s: initials avatar, stencil count `4 / 7`, gold progress bar (CountUp + width transition), goal-hit state = gold card + 🎉 badge; fire confetti once per rep per day (client-side memory of seen goal-hits). Monthly/pipeline = ranked manila table rows with rank numerals, movement handled purely by sort. Empty state: "No bookings yet today — be the first 🎉".
- [ ] **Step 2:** Visual pass: Big Shoulders numerals, ink/manila/gold only, focus-visible, reduced-motion (no confetti, no transitions).
- [ ] **Step 3:** Playwright: quick-add → Daily board count increments within 4 s without reload (poll proves the fallback path).
- [ ] **Step 4:** Check + commit: `feat(dashboard): live leaderboard landing with goal celebrations`.

## Phase 5 — Roster + Manage

### Task 12: Roster + timesheet screen

**Files:**
- Create: `src/app/(app)/roster/page.tsx`, `src/components/RosterGrid.tsx`, `src/components/TimesheetTable.tsx`, `src/app/actions/roster.ts`

- [ ] **Step 1:** `actions/roster.ts`: `setShift(staffId, weekday, start, end)` / `clearShift`, `addTimeOff(staffId, from, to, reason)` / `removeTimeOff` — manager-only, audited.
- [ ] **Step 2:** Roster tab: Mon–Sun grid (rows = active staff, cells = shift time or —; manager cells are popover edit forms; today's column highlighted gold); Time-off panel listing current/future rows (manager add/remove). Timesheet tab (same page, tab switch): per-staff today states from `dayStates` (live via `useLiveRefresh(["clock"])`), weekly hours table from `weekHours`, lateness + auto-close flags as soft amber chips.
- [ ] **Step 3:** Playwright: manager sets a shift, rep sees it read-only. Check + commit: `feat(dashboard): roster grid, time off, timesheet with lateness flags`.

### Task 13: Manage area + CSV export

**Files:**
- Create: `src/app/(app)/manage/page.tsx`, `src/app/actions/manage.ts`, `src/app/(app)/manage/export/route.ts`, `src/components/StaffTable.tsx`

- [ ] **Step 1:** `actions/manage.ts` (all `requireManager`, all audited): `addStaff(name, role)` (id slugified, PIN "1234" forced), `setPin(staffId, pin)` (4–6 digits validated), `unlock(staffId)`, `deactivate/reactivate`, `setGoal(staffId, dailyTarget)` (insert goals row effective today), `setIntakeWeight(staffId, weight)`.
- [ ] **Step 2:** Manage page: staff table (role, active, locked badge + unlock, goal inline edit, weight inline edit, reset-PIN dialog), audit log table (latest 100, filter by staff/action), export buttons.
- [ ] **Step 3:** `export/route.ts` (GET `?what=bookings|timesheets&from&to`, manager session): streams CSV (`text/csv`, header row, RFC4180 escaping). Bookings: all columns; Timesheets: staff/date/in/breaks/out/hours/flags.
- [ ] **Step 4:** Unit test CSV escaping (`"`, `,`, newline in customer name). Playwright: manager resets a PIN; locked rep unlock flow. Check + commit: `feat(dashboard): manage area, PIN administration, CSV exports`.

## Phase 6 — TV + polish

### Task 14: /tv mode

**Files:**
- Create: `src/app/(bare)/tv/page.tsx`, `src/components/TvBoard.tsx`

- [ ] **Step 1:** `TvBoard` (client, chromeless, `h-dvh` ink, no nav): cycles Daily → Monthly → Next 3 Months every 20 s (pauses cycle while a goal celebration is animating); giant stencil numerals (clamp ~8vw), top strip = Sydney clock + date + "NO LIMITS OPS"; data via `/api/boards` + `useLiveRefresh`; goal-hit → full-screen confetti + rep name flung up in gold (no sound, v1). Stale guard: if no successful fetch for >30 s show persistent amber banner "Reconnecting — numbers may be behind".
- [ ] **Step 2:** Playwright: `/tv` renders without session; quick-add in another context updates TV count ≤4 s; kill API (intercept route, abort) → banner appears.
- [ ] **Step 3:** Check + commit: `feat(dashboard): wall TV mode with cycling boards and stale guard`.

### Task 15: Hardening + audits + docs

**Files:**
- Modify: various; Create: `apps/dashboard/README.md`
- Test: contrast audit script (reuse `/tmp/contrast-audit.cjs` pattern committed as `apps/dashboard/scripts/contrast-audit.cjs`)

- [ ] **Step 1:** Permissions sweep test: table-driven vitest over every server action × (anon, rep, other-rep, manager) asserting allow/deny matrix.
- [ ] **Step 2:** Contrast audit across: sign-in, board (all tabs), bookings list/detail, roster both tabs, manage, /tv, dialogs open — fix every failure (real text AA, decorative ≥2.5).
- [ ] **Step 3:** Full Playwright suite green; `pnpm check` green.
- [ ] **Step 4:** `README.md`: env contract, PGlite vs prod, migrations via SQL editor (`db:sql`), seeding, PIN policy (defaults + day-one rotation), cron setup, TV kiosk setup (browser full-screen, URL), v2 backlog pointer to spec.
- [ ] **Step 5:** Update root `TODO.md` (dashboard shipped; Supabase envs to set in Vercel; rotate seeded PINs). Commit: `feat(dashboard): permission matrix tests, contrast pass, ops README`.

### Task 16: Deploy wiring (owner-assisted)

- [ ] **Step 1:** Verify prod build with `DATABASE_URL` unset (PGlite) — CI-safe.
- [ ] **Step 2:** Owner: new Vercel project → root `apps/dashboard` → env vars (`DATABASE_URL` pooler+password, `SESSION_SECRET`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `CRON_SECRET`).
- [ ] **Step 3:** Owner: paste `db:sql` output into Supabase SQL Editor → run; then seed via local `db:seed` with `DATABASE_URL` or paste `db:seed --sql` output (seed script supports `--sql` flag printing INSERTs).
- [ ] **Step 4:** Smoke: sign-in, quick-add, board, TV on the wall. Rotate PINs in /manage.

---

## Self-review checklist (run after writing)

- Spec coverage: sign-in/PIN/lockout (T4), quick-add ≤3 fields (T8), boards + Yesterday + semantics (T3/T10/T11), clock machine + bar + midnight close (T6/T7), roster + time-off + timesheet-in-roster (T12), manage + goals + weights + exports + audit UI (T13), TV cycle + stale guard + confetti-only (T14), audit log everywhere (T5+actions), soft delete (T8/T9), duplicate jobNumber UX (T8), CSV (T13), permissions matrix (T15), contrast audit (T15), env/migrations/README (T15/T16), seed real reps/goals/weights (T5).
- Out-of-scope guard: no payroll, no lead queue, no messages, no Game Day — confirmed absent.
- Type consistency: `deriveClock/nextActions/assertTransition` names used consistently (T6/T7/T12); board return shape `{staffId,name,count,goal?}` (T10/T11/T14); `notify(scope)`/`useLiveRefresh(scopes)` (T8/T10/T11/T12/T14).
