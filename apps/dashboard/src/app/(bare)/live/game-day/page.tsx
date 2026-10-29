import { getBoardsSnapshot } from "../../../../db/queries/boards-snapshot";
import { GameDayWall } from "../../../../components/GameDayWall";

export const metadata = { title: "Game Day" };
export const dynamic = "force-dynamic";
export const maxDuration = 25;

/**
 * Full-screen Game Day wall display (Green vs Purple — plus a third Cyan team of
 * unassigned reps, laid out as a triangle), no app chrome. Initial data
 * is the cached board snapshot; GameDayWall then polls /api/boards, runs the
 * per-booking celebration, and replays the intro whenever Game Day flips on.
 */
export default async function LiveGameDayPage() {
  const initial = await getBoardsSnapshot();
  return <GameDayWall initial={initial} />;
}
