import { getBoardsSnapshot } from "../../../db/queries/boards-snapshot";
import { LiveBoard } from "../../../components/LiveBoard";

export const metadata = { title: "Live board" };
export const dynamic = "force-dynamic";
export const maxDuration = 25;

/**
 * Wall-display leaderboard — the dashboard's "Today" board, full-screen with no
 * app chrome. Initial data is the cached board snapshot; LiveBoard then polls
 * /api/boards and runs the per-booking celebration.
 */
export default async function LivePage() {
  const initial = await getBoardsSnapshot();
  return <LiveBoard initial={initial} />;
}
