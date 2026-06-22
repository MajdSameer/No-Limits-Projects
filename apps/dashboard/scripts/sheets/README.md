# Leaderboard → dashboard live push (Apps Script)

`leaderboard.gs` runs inside the company **Follow-Up** spreadsheet and pushes the
`Leaderboard` tab to the dashboard in near real time. This is the "live and
updating" path: it runs as the sheet owner, so there's no Google OAuth token to
expire (unlike the `pnpm db:sync-sheet` pull).

```
Leaderboard tab ──(onEdit + 5-min timer)──▶ POST /api/ingest/leaderboard ──▶ rep_live ──▶ /live board
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
   This installs the `onEdit` trigger + a 5-minute safety timer.
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

`inspectors.gs` is bound to the **site-inspection bookings** spreadsheet (its own
Apps Script project + `DASHBOARD_URL` / `INGEST_SECRET` script properties, same
values). It finds the tab with a **Site Inspector** column and reads, per row,
the **Date**, **Sales Person**, **Job Number** and **Site Inspector**. It POSTs
**today's** job-numbered inspections, grouped by inspector, to
`/api/ingest/inspectors`, which drives the dedicated **Site Inspectors** boxes on
`/live` (Martin, Danny…) and the **applause** celebration — inspector name, the
job number, and the sales rep whose customer the inspection is for.

1. Open the bookings sheet → **Extensions → Apps Script**, paste `inspectors.gs`.
2. Set the two script properties, run **`installInspectorTriggers`** (onEdit +
   5-minute timer).
3. Test: run **`pushInspections`**, then open `/live`.

Only inspections that have a **job number** count toward an inspector's daily
total (a site inspection isn't "real" until it has a MovePro number). Inspectors
with none today still show their box at 0. Columns are matched by header name, so
reordering them is fine; the day is Sydney time, matching the dashboard.

## Notes

- The endpoint is idempotent and secret-protected; re-pushing is harmless.
- Ranges live at the top of the script (`ROSTER_RANGE`, `COUNTS_RANGE`). If the
  sheet layout moves, adjust them there.
- `/live` is a separate wall board from `/tv` (which is computed from the app's
  own bookings) so the two never conflict. Put whichever you want on the TV.
- To rotate the secret: change it in Vercel **and** in Script properties.
