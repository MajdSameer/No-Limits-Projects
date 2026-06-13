import { Board } from "../../components/Board";
import { dailyBoard, monthlyBoard, pipelineBoard, yesterdayBoard } from "../../db/queries/boards";
import { liveAllocation } from "../../db/queries/allocation";
import { isGameDay } from "../../db/settings";
import { greeting } from "../../lib/leaderboard-messages";
import { getSession } from "../../lib/session";
import { sydneyToday } from "../../lib/sydney";

export const dynamic = "force-dynamic";

export default async function BoardPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  const now = new Date();
  const session = await getSession();
  const { welcome: welcomeFlag } = await searchParams;
  const [daily, yesterday, monthly, pipeline, allocation, gameDay] = await Promise.all([
    dailyBoard(now),
    yesterdayBoard(now),
    monthlyBoard(now),
    pipelineBoard(now),
    liveAllocation(now),
    isGameDay(),
  ]);

  const welcome =
    welcomeFlag === "1" && session ? greeting(session.name, sydneyToday(now)) : null;

  return (
    <Board
      initial={{
        daily,
        yesterday,
        monthly,
        pipeline,
        allocation,
        gameDay,
        generatedAtISO: now.toISOString(),
      }}
      welcome={welcome}
      isManager={session?.role === "manager"}
    />
  );
}
