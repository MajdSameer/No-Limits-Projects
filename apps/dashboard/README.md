# No Limits Ops — staff dashboard

The sales floor's system of record: bookings (quick-add by MovePro job
number), live leaderboards (daily / monthly / next-3-months + yesterday),
clock in/out with timesheets, weekly roster, manager admin, and a wall-TV
board. Replaces the Google Sheets workflow per
`docs/superpowers/specs/2026-06-12-staff-dashboard-design.md`.

## Run it

```bash
pnpm --filter @nlr/dashboard dev     # http://localhost:3000
pnpm --filter @nlr/dashboard db:seed # seed the real floor (PGlite)
pnpm --filter @nlr/dashboard test    # vitest suite
```

No env needed locally: without `DATABASE_URL` the app uses **PGlite**
(./.pglite — delete to reset) with auto-applied migrations.

## Environment (prod — set in Vercel)

| Var | What |
| --- | --- |
| `DATABASE_URL` | Supabase **pooler** URL incl. db password (Settings → Database → Connection string → Transaction). Never commit/share it. |
| `SESSION_SECRET` | `openssl rand -base64 32` |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Realtime ping bus (publishable key). Omit both → poll-only mode (still fully live at 3 s). |
| `CRON_SECRET` | Random string; Vercel cron sends it as `Authorization: Bearer`. |

## Migrations + seed against Supabase

No password through chat/CI needed:

1. `pnpm --filter @nlr/dashboard db:sql` → paste output into Supabase
   **SQL Editor** → Run. (Or locally: `DATABASE_URL=… pnpm db:migrate`.)
2. Seed: `DATABASE_URL=… pnpm --filter @nlr/dashboard db:seed`.

## PIN policy

Seeded defaults: reps `1234`, manager `123456`. **Rotate in /manage on day
one.** 5 wrong attempts locks an account; managers unlock in /manage.
Sessions last 12 h.

## The TV

Open `/tv` full-screen (kiosk mode) on the wall display — no sign-in, shows
first names + counts only. Cycles Daily → Monthly → Next-3-months every
20 s; amber banner appears if data goes stale >30 s.

## Architecture notes

- All day/month boundaries are **Australia/Sydney** (`src/lib/sydney.ts`,
  DST-tested). Timestamps stored UTC.
- Mutations: server actions → permission checks (`rep` own bookings;
  `manager` everything) → audit_log row → realtime ping. Clients refetch on
  ping AND on a 3 s poll — realtime is enhancement, polling is guarantee.
- Forgotten clock-outs: `/api/cron/midnight` (vercel.json, 00:05 Sydney)
  auto-closes and flags them.
- Contrast audit: `node scripts/contrast-audit.cjs` against a seeded dev
  server on :3001 — must print `TOTAL FAILURES: 0`.

## v2 backlog

See the spec: crew payroll + profit, customer messages, lead-intake queue,
Game Day teams, history import, PM/RRR brand views, MovePro API.
