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

## Notes

- The endpoint is idempotent and secret-protected; re-pushing is harmless.
- Ranges live at the top of the script (`ROSTER_RANGE`, `COUNTS_RANGE`). If the
  sheet layout moves, adjust them there.
- `/live` is a separate wall board from `/tv` (which is computed from the app's
  own bookings) so the two never conflict. Put whichever you want on the TV.
- To rotate the secret: change it in Vercel **and** in Script properties.
