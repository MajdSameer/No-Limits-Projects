# Leaderboard → dashboard live push (Apps Script)

`leaderboard.gs` runs inside the company **Follow-Up** spreadsheet and pushes the
`Leaderboard` tab to the dashboard in near real time. This is the "live and
updating" path: it runs as the sheet owner, so there's no Google OAuth token to
expire (unlike the `pnpm db:sync-sheet` pull).

```
Leaderboard tab ──(onEdit + 1-min timer)──▶ POST /api/ingest/leaderboard ──▶ rep_live ──▶ /live board
```

## One-time setup

1. **Deploy the dashboard** with `INGEST_SECRET` set (see the app `.env.example`).
   Pick a long random value; set the same value in both places below.
2. In the **Follow-Up** spreadsheet: **Extensions → Apps Script**. Delete the
   stub `Code.gs`, paste in `leaderboard.gs`, Save.
3. **Project Settings → Script properties → Add script property** (twice):
   - `DASHBOARD_URL` = `https://<your-dashboard>.vercel.app`
   - `INGEST_SECRET` = the same secret you set in Vercel
4. Back in the editor, select **`installTriggers`** in the function dropdown and
   click **Run**. Approve the authorization prompt (it's your own sheet).
   This installs the `onEdit` trigger + a 1-minute safety timer.
5. Test now: select **`pushLeaderboard`** → **Run**. Check the execution log for
   the JSON response, then open `/live` on the dashboard.

## Roster push (`roster.gs`)

`roster.gs` goes in the **same** Apps Script project (same spreadsheet, same
`DASHBOARD_URL` / `INGEST_SECRET`). It reads the **Live Roster** tab's weekly
grid (who works which day) and POSTs to `/api/ingest/roster`, which writes the
`shifts` table behind the dashboard's `/roster` and `/manage` views.

1. In the Apps Script editor, **add a file** (`roster.gs`) and paste it in.
2. Select **`installRosterTriggers`** → **Run** (this is in addition to the
   leaderboard's `installTriggers`). It adds an edit trigger on the Live Roster
   tab + a 15-minute timer.
3. Test: select **`pushRoster`** → **Run**, then open `/roster`.

The grid only says who works which day, not the times, so every worked day is
written as a **08:00–17:00** shift. Managers can fine-tune individual shift
times in `/manage` (those edits hold until the day-set changes in the sheet).
The "Afternoon / 8-to-7" sub-block and lunch-break columns are not synced yet.

## Bookings push (`bookings.gs`)

`bookings.gs` is bound to a **different** spreadsheet — **No Limits & RRR
Removals** — so it's its **own** Apps Script project with its own copy of the
`DASHBOARD_URL` / `INGEST_SECRET` script properties (same values). It reads the
**Booking** tab and POSTs the last 90 days of move dates plus all future ones to
`/api/ingest/bookings`, in batches.

1. Open the **No Limits & RRR Removals** sheet → **Extensions → Apps Script**.
2. Paste `bookings.gs`, set the two script properties, run **`installBookingTriggers`**.
3. Test: run **`pushBookings`**, then open `/bookings` (and `/subcontractor` for
   Domanic's jobs).

The dashboard side only keeps NL/RRR/PM companies and bookings by a roster rep
or the subcontractor **Domanic** (his are flagged and shown on `/subcontractor`,
split into **Daily** / **This month** tabs). Everything else is skipped. Upsert
is keyed on job number, so re-pushing is idempotent.

Alongside the booking sync, the same push sends a per-rep **monthly NET revenue**
tally to `/api/ingest/monthly` (`revenue` field). For every row with a move date
in the current month it sums **col AT − AK − AL − AM − BB** (the total minus the
extra charges that don't go to the sales rep; the deposit is already part of AT),
across done and upcoming jobs alike. The dashboard shows each rep their NET
revenue under their name in the `/live` "This month" column. The read range was
widened to col BB, so re-paste `bookings.gs` and run `pushBookings` once after
updating.

## Leads push (`leads.gs`)

`leads.gs` is bound to the **Quote Leads Auto Process** spreadsheet (its own
Apps Script project + script properties). It reads recent rows of the **Auto**
tab and POSTs them to `/api/ingest/leads`, which **dedupes** on the lead id and
**auto-allocates** each new lead to whoever's next up by the sheet clock
(recorded in `leads`, so the allocator and boards see it). Leads that arrive
while no one is clocked in are parked as "awaiting" on `/leads`.

1. Open the **Quote Leads Auto Process** sheet → **Extensions → Apps Script**.
2. Paste `leads.gs`, set the two script properties, run **`installLeadTriggers`**.
3. Test: run **`pushLeads`**, then open `/leads`.

Auto-allocation depends on the Leaderboard push (rep_live) being live, since
that's where the clock comes from — install `leaderboard.gs` first.

## Site inspections push (`inspectors.gs`)

`inspectors.gs` pulls from **two different tabs for two different numbers**,
because they turned out to track different things. It's an **extra file in
the Follow-Up Apps Script project** (alongside `leaderboard.gs` /
`roster.gs`) and reuses the project's existing `DASHBOARD_URL` /
`INGEST_SECRET` script properties. It POSTs to `/api/ingest/inspectors`,
which drives the green **Site Inspectors** boxes on `/live` (Martin, Danny)
and the **applause** celebration:

- **Today's jobs** come from the **Leaderboard tab's hand-kept entry block**
  (job#/rep grow down from row 198 — Martin col **AU** job# / **BA** rep,
  Danny col **BJ** job# / **BP** rep). Staff keep this block updated in real
  time as inspections actually happen, and it gets reset each day — so
  whatever's filled in there right now is "today."
- **This month's total** comes from the **"Site Inspection Booked"** tab
  instead (one row per booking — col **D** date, **E** sales person, **F**
  job number, **H** inspector) — every row for that inspector this calendar
  month, no dedup and no job-code format validation (matches the sheet's own
  reference `SUMPRODUCT` count over the same tab exactly).

Why two sources: the "Site Inspection Booked" tab's dates aren't a reliable
same-day signal — inspections get pre-booked there well in advance, so a row
dated today doesn't mean it happened today. We tried reading "today" from
that tab too and it didn't match what staff actually see on the ground; the
Leaderboard block is the real-time source for that. Tab names/columns are
constants at the top of the script — adjust them there if either tab is
renamed or the columns move.

**Keep `INSP_MAXROWS` small.** A completely unrelated "Highest Revenue Job"
rankings table starts around row ~228 in these SAME columns (AU/BA, BJ/BP) —
a wide scan range picks up its cells as if they were job#/rep pairs (a
rank-list name landing in the job# column, paired with an unrelated name in
the rep column, showing up as a phantom inspection + celebration). The day's
real entries are always a handful of rows, so keep the constant well short of
that table's start — 20 gives generous headroom.

1. In the **Follow-Up** sheet's Apps Script project, **add a file** and paste in
   `inspectors.gs`, Save.
2. Run **`installInspectorTriggers`** — it installs **only** its own triggers (a
   section-scoped onEdit + a 5-minute timer) and leaves the leaderboard/roster
   triggers alone.
3. Test: run **`pushInspections`**, check the log (`Name (today N, month M)`),
   then open `/live`.

## Notes

- The endpoint is idempotent and secret-protected; re-pushing is harmless.
- Ranges live at the top of the script (`ROSTER_RANGE`, `COUNTS_RANGE`). If the
  sheet layout moves, adjust them there.
- `/live` is a separate wall board from `/tv` (which is computed from the app's
  own bookings) so the two never conflict. Put whichever you want on the TV.
- To rotate the secret: change it in Vercel **and** in Script properties.
