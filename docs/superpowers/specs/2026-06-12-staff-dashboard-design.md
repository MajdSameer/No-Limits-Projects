# No Limits Ops — staff dashboard (v1) — design

**Date:** 2026-06-12 · **Status:** Approved (design review + 2-stage model-council review, this session)
**Goal:** Replace the Google Sheets sales-floor OS (leaderboard/roster/timesheet workbook + booking workbook) with one fast, rep-proof web app that is the company's system of record.

## What the sheets do today (decoded, both workbooks analysed)

**"Follow-Up" workbook:**
- **Leaderboard tab:** per-rep clock times (in/break/out) → live working hours
  → × per-rep *intake weight* (0.5–1.1) → fair-share lead expectation; a
  filtered, sorted **lead-intake queue** of clocked-in, not-on-break reps
  (deferred to v2 by decision); **Daily board** = MovePro job codes pasted
  into a per-rep grid by type (Moving/Storage/Cleaning/Car relocation),
  counted vs per-rep daily goal (column C: 3–8) with 🎉 celebration;
  **Monthly** and **Next-3-months** boards; **Yesterday** snapshot tab;
  **Game Day** team-battle overlay (Orange vs Blue); sync-health checks
  (IMPORTRANGE from a separate Lead Allocator sheet breaks routinely).
- **Live Roster tab:** Mon–Sun grid of who works, morning/afternoon splits,
  lunch-break slots, time-off notes panel.
- **Timesheet (Sales):** 616 columns — repeating per-rep blocks per date:
  in/break/out, hours minus half-hour break, day/hourly-rate multipliers,
  lateness vs shift, notes.
- **Data tab:** the taxonomy — lead sources (Muval, OneFlare, Find a Mover,
  Moving Select, High Pages, Bark, Moving 24, Rem. Compare/Auction, PM
  variants, Social Media, Returning customer, Word of Mouth…), statuses
  (No Answer, Follow-Up, Interested, Won, Booked (Deposit), Refunded Lead,
  Invalid Lead, Lost, Site Inspection), quote types (Local/Fixed/Shareload),
  truck sizes, shift-confirmation templates, crew names + pay rates.
- **Info tab:** ops wiki — bank accounts, **ABN 69 657 017 822**, phone
  extensions, message templates, links to further sheets.

**Booking workbook:** ~105 columns × 60 slots/day per row: job number
(MovePro numeric or 5-char code), company (**NO LIMITS / Professional
Movers / RRR** — multi-brand), lead source, sales person, customer
(name/mobile/emergency/email), pickup/delivery, state, backload info,
capacity, days/beds/cubic/men/callout, deposit, rates → totals → payments
(Cash / NL Bank TFR / NL Stripe, +2.5% card), crew assignment (truck,
driver, offsiders ×3), per-person payroll, per-job profit ("Remaining for
NOLIMITS"), Muval fees, and auto-generated customer messages (confirmation,
day-before, feedback, subbie offer).

## Decisions (locked with the owner)

| Decision | Choice |
| --- | --- |
| v1 scope | Core ops: bookings CRUD, 3 leaderboards, clock in/out, roster view. No payroll / lead queue / messages / Game Day in v1 |
| Period semantics | Daily & Monthly = bookings **entered** today / this calendar month. Next-3-months = **move date** within next 3 months (pipeline) |
| Lead counting | Deferred entirely (Lead Allocator sheet untouched in v1) |
| Sheets at cutover | **App is source of truth** from day one; CSV export for backup; no two-way sync; no history import (boards start fresh — backfill possible later via import utility if ever wanted) |
| Sign-in | Name picker + 4–6 digit PIN (managers: longer PIN). 5 failures → locked, manager unlocks |
| Edit rights | Reps edit **own** bookings only; managers edit all, manage staff/goals; every mutation audited |
| Devices | Desktop primary + wall-TV mode. (Responsive layout comes with the stack; phones not a v1 acceptance target) |
| Booking entry | Quick-add (≤3 required fields) counts instantly; record completed later |

## Council verdict (2-stage llm-council protocol, 3 models)

Stage 1 unanimous + stage 2 red-team (5–1 final): **Supabase** (Postgres +
Realtime + RLS) over Vercel-native Neon+polling. Decisive: realtime push
for the always-on TV, DB-level permission enforcement, managed
backups/PITR for what becomes the company's operational database.
Dissent absorbed as conditions: (1) all access through typed **Drizzle**
queries + git-versioned migrations (no hand-edited policy soup), (2)
**3-second poll fallback** — realtime is an enhancement, never a
dependency, (3) Timesheet lives inside Roster (one surface), (4) confetti
only in v1 — no TV audio (autoplay fragility); sound behind a manager
toggle later. Unanimous council findings: quick-add friction is the
existential risk (<20s or reps revert to sheets); Board is the landing
page; TV is a chromeless route, not nav.

## Architecture

- `apps/dashboard` in the existing monorepo (inherits tokens, @nlr/ui,
  motion system, conventions; `transpilePackages` per template).
- **Supabase Postgres** via **Drizzle ORM**; schema + migrations in-repo
  (`apps/dashboard/src/db/`). Server Actions perform all mutations;
  per-session JWT (jose, httpOnly cookie, 12 h) carries staff id + role;
  Supabase RLS policies mirror the server checks as defense-in-depth
  (service-role key only for migrations/admin scripts; never in request
  path).
- **Realtime:** Supabase channels on `bookings` + `clock_events`; clients
  patch state on events; SWR-style 3 s poll fallback; TV shows a stale
  banner if no signal for >30 s.
- **Timezone:** `Australia/Sydney` for all day/month boundaries
  (`date-fns-tz`); stored as UTC timestamps.
- Env vars documented in `.env.example` (SUPABASE_URL, SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY [local/migration only], SESSION_SECRET).

## Data model

- `staff`: id, name, display_name, role (`rep`|`manager`), pin_hash
  (bcrypt), intake_weight (numeric, default 1.0 — from sheet col A),
  active, failed_attempts, locked_at, created_at.
- `bookings`: id, job_number (**unique**, text — accepts `115678` and
  `98RRX` forms), company (`NL`|`PM`|`RRR`, default NL), type
  (`moving`|`storage`|`cleaning`|`car`), status (taxonomy from Data tab,
  default `booked`), customer_name, customer_phone, customer_email,
  pickup, delivery, state, move_date (date), value (numeric, nullable),
  deposit (numeric, nullable), beds, cubic, men, lead_source, notes,
  sales_rep_id → staff, entered_at (timestamptz, **leaderboard key**),
  created_by, updated_at, deleted_at (soft delete, manager-only).
  Detail-completion = derived % of the encouraged fields filled.
- `clock_events`: id, staff_id, kind (`in`|`break_start`|`break_end`|`out`),
  at (timestamptz), source (`self`|`manager`), edited_by, note.
  Invariant: events for a staff member form a valid state machine per
  Sydney day; server rejects out-of-order events; midnight auto-close job
  inserts `out` at 23:59 flagged `source='system'` for manager review.
- `shifts`: id, staff_id, weekday (0–6) **or** date override, start, end,
  note (roster); time-off = `time_off` rows (staff_id, from_date, to_date,
  reason).
- `goals`: staff_id, daily_target (int), effective_from.
- `audit_log`: id, staff_id, action, entity, entity_id, diff (jsonb), at.

## Screens

1. **/sign-in** — staff grid → PIN pad. Big targets, zero typing of names.
2. **/ (Board)** — Daily | Monthly | Next 3 Months tabs + Yesterday filter.
   Daily: rep cards (avatar initials, `4 / 7`, progress bar, gold 🎉
   takeover at goal). Monthly/3-month: ranked tables, movement arrows,
   type filter. Live.
3. **/bookings** — table: job number, customer, route, rep, type,
   move date, value, completion meter; filters (today/week/incomplete/
   mine); row → **/bookings/[id]** full record grouped in sections
   (Customer / Move / Money / Notes), inline edit per permissions, audit
   trail footer, "complete the details" callouts.
4. **/roster** — week grid (reps read, managers drag-edit), time-off
   panel; **Timesheet tab**: live clock states, weekly hours per rep,
   soft lateness flags vs shift.
5. **/manage** (managers) — staff (add/deactivate, reset PIN, unlock,
   intake weight), goals, CSV exports (bookings, timesheets), audit log.
6. **/tv** — chromeless; auto-cycles boards 20 s; giant stencil numerals;
   confetti on goal events; self-heals; stale banner.
7. **Persistent chrome** (all rep screens): header with **+ Job** gold
   pill (quick-add modal: job_number*, type*, move_date*, then customer,
   suburbs, value, deposit optional) and the **clock bar** footer (state +
   single next-action button: Clock in → Start break / Clock out …).

## Error handling & edge cases

- Duplicate job number → inline "already entered by {rep} at {time}",
  link to that booking.
- PIN: rate-limited, lockout after 5, manager unlock; PINs never logged.
- Forgotten clock-out: system midnight close + review flag.
- Realtime down: poll continues; TV banners after 30 s of silence.
- Soft deletes only; restore from /manage; full audit trail.
- All forms: optimistic UI with server reconciliation; failures toast and
  retain input.
- Empty states everywhere ("No bookings yet today — be the first 🎉").

## Design language

Freight Manifest extended to an ops room: ink ground, manila data
surfaces, gold accents and stencil numerals (Big Shoulders) for board
figures; Work Sans for data; motion system reused (CountUp, Reveal,
confetti moment). Accessibility floor as per repo invariants; the
contrast audit script runs against the dashboard too.

## Testing

- Unit: period bucketing (Sydney midnight/month edges, next-3-months
  windows), clock state machine (all transitions + invalid), permissions
  matrix, duplicate job numbers.
- Integration: server actions against a test database.
- Playwright: PIN sign-in, quick-add <20 s flow, clock cycle, board
  updates after add, TV render, manager goal edit.
- Contrast audit across screens/states.

## Rollout

1. Seed staff from the sheet's rep list (names + goals + intake weights);
   owner sets PINs on day one via /manage.
2. Week 1 pilot: boards + quick-add + clock alongside the sheet (dual
   entry by choice, not sync).
3. Cutover: sheet grid frozen ("enter in the app — link"), sheets kept
   read-only as history.
4. Success: every booking entered in-app same-day; clock adoption 100%;
   board on the TV all day; zero "where do I put this?" questions after
   week one.

## v2 backlog (schema-ready, explicitly out of v1)

Per-job crew assignment + payroll + profit; auto customer messages
(templates live in the booking sheet today); lead-intake queue + Lead
Allocator replacement (intake_weight already stored); Game Day team
battles + TV sound toggle; Trucks-to-be-Filled; cleaning quotes; history
import utility; Professional Movers / RRR brand views (company field
already on bookings); MovePro API integration when confirmed (job_number
is the join key).
