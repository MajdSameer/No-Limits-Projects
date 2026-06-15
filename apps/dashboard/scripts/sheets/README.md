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

## Notes

- The endpoint is idempotent and secret-protected; re-pushing is harmless.
- Ranges live at the top of the script (`ROSTER_RANGE`, `COUNTS_RANGE`). If the
  sheet layout moves, adjust them there.
- `/live` is a separate wall board from `/tv` (which is computed from the app's
  own bookings) so the two never conflict. Put whichever you want on the TV.
- To rotate the secret: change it in Vercel **and** in Script properties.
