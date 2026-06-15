import { liveLeaderboard } from "../../../db/queries/live";
import { LiveRefresher } from "../../../components/LiveRefresher";

export const metadata = { title: "Live board" };
export const dynamic = "force-dynamic";

/**
 * Wall-display board driven straight from the company "Leaderboard" sheet
 * (pushed via api/ingest/leaderboard). Separate from /tv (which is computed
 * from the app's own bookings) so the two never fight. Auto-refreshes.
 */
export default async function LivePage() {
  const rows = await liveLeaderboard();
  const total = rows.reduce((s, r) => s + r.bookingsToday, 0);
  const lastUpdated = rows
    .map((r) => r.updatedAtISO)
    .filter((v): v is string => Boolean(v))
    .sort()
    .at(-1);

  return (
    <main id="main" className="min-h-dvh bg-brand-900 text-white">
      <LiveRefresher />
      <div className="mx-auto max-w-5xl px-6 py-8">
        <header className="mb-8 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Live board</h1>
            <p className="mt-1 text-brand-100">Bookings today · straight from the sheet</p>
          </div>
          <div className="text-right">
            <div className="text-5xl font-black text-accent-400 tabular-nums sm:text-6xl">
              {total}
            </div>
            <div className="text-sm text-brand-100">total today</div>
          </div>
        </header>

        {rows.length === 0 ? (
          <p className="rounded-xl bg-brand-800 p-6 text-brand-100">
            No reps yet. Once the sheet pushes a snapshot, the board fills in here.
          </p>
        ) : (
          <ol className="space-y-2">
            {rows.map((r, i) => {
              const pct = r.goal ? Math.min(100, Math.round((r.bookingsToday / r.goal) * 100)) : 0;
              const hit = r.goal != null && r.bookingsToday >= r.goal;
              return (
                <li
                  key={r.staffId}
                  className="flex items-center gap-4 rounded-xl bg-brand-800 px-4 py-3"
                >
                  <span className="w-6 shrink-0 text-center text-lg font-bold text-brand-100 tabular-nums">
                    {i + 1}
                  </span>
                  <span
                    className={`size-2.5 shrink-0 rounded-full ${r.onShift ? "bg-accent-400" : "bg-brand-600"}`}
                    aria-label={r.onShift ? "on shift" : "off"}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-lg font-semibold">{r.name}</div>
                    {r.goal != null && (
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-brand-900">
                        <div
                          className={`h-full rounded-full ${hit ? "bg-accent-400" : "bg-accent-600"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    )}
                  </div>
                  <div className="shrink-0 text-right tabular-nums">
                    <span className="text-2xl font-black">{r.bookingsToday}</span>
                    {r.goal != null && <span className="text-brand-100"> / {r.goal}</span>}
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        <p className="mt-6 text-right text-xs text-brand-100">
          {lastUpdated
            ? `Updated ${new Date(lastUpdated).toLocaleTimeString("en-AU", { timeZone: "Australia/Sydney" })}`
            : "Awaiting first push"}
        </p>
      </div>
    </main>
  );
}
