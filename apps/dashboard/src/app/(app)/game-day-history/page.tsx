import { listGameDayResults } from "../../../db/queries/game-day-results";
import { requireSession } from "../../../lib/session";

export const metadata = { title: "Game Day history" };
export const dynamic = "force-dynamic";

// GameDayWall.tsx keeps "orange"/"blue" as the DB/code values (so
// BoardRowDTO.team doesn't need a migration) but shows the teams as
// Green/Purple — same rename-in-UI-only applies here.
const TEAM_LABEL: Record<"orange" | "blue", string> = { orange: "Green", blue: "Purple" };

export default async function GameDayHistoryPage() {
  await requireSession();
  const results = await listGameDayResults();

  return (
    <div>
      <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">Game Day</p>
      <h1 className="mt-1 text-4xl font-bold tracking-tight text-brand-900">History</h1>

      {results.length === 0 ? (
        <p className="mt-10 text-sm font-medium text-slate-500">
          No Game Day results captured yet — they're saved automatically at 7pm on any day Game Day mode is on.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full border-collapse text-sm text-brand-950">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold text-slate-500">
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Green</th>
                <th className="px-3 py-2">Purple</th>
                <th className="px-3 py-2">Winner</th>
                <th className="px-3 py-2">Top scorer(s)</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => {
                const topScorers = r.reps.filter((rep) => r.topScorerIds.includes(rep.staffId));
                return (
                  <tr key={r.date} className="border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50">
                    <td className="px-3 py-2.5 font-semibold">{r.date}</td>
                    <td className="px-3 py-2.5 tabular-nums">{r.orangeTotal}</td>
                    <td className="px-3 py-2.5 tabular-nums">{r.blueTotal}</td>
                    <td className="px-3 py-2.5">
                      {r.winner ? `${TEAM_LABEL[r.winner]} · $${r.teamPrize}/rep` : "Tie"}
                    </td>
                    <td className="px-3 py-2.5">
                      {topScorers.length > 0
                        ? `${topScorers.map((rep) => rep.name).join(", ")} · $${r.topScorerPrize}`
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
