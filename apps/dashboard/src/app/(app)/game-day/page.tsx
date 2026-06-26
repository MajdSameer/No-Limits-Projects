import { GameDayView } from "../../../components/GameDayView";
import { dailyBoard } from "../../../db/queries/boards";
import { getTopRevenueJob, isGameDay } from "../../../db/settings";
import { getSession } from "../../../lib/session";

export const metadata = { title: "Game Day" };
export const dynamic = "force-dynamic";

export default async function GameDayPage() {
  const session = await getSession();
  const [daily, gameDay, topRevenueJob] = await Promise.all([
    dailyBoard(),
    isGameDay(),
    getTopRevenueJob(),
  ]);
  return (
    <GameDayView
      initial={{ daily, gameDay, topRevenueJob }}
      isManager={session?.role === "manager"}
    />
  );
}
