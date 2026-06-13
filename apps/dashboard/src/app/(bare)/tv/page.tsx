import { dailyBoard, monthlyBoard, pipelineBoard, yesterdayBoard } from "../../../db/queries/boards";
import { liveAllocation } from "../../../db/queries/allocation";
import { getMonthlyGoal, isGameDay } from "../../../db/settings";
import { TvBoard } from "../../../components/TvBoard";

export const metadata = { title: "TV board" };
export const dynamic = "force-dynamic";

export default async function TvPage() {
  const now = new Date();
  const [daily, yesterday, monthly, pipeline, allocation, gameDay, monthlyGoal] = await Promise.all([
    dailyBoard(now),
    yesterdayBoard(now),
    monthlyBoard(now),
    pipelineBoard(now),
    liveAllocation(now),
    isGameDay(),
    getMonthlyGoal(),
  ]);
  const monthlyTotal = monthly.reduce((s, r) => s + r.count, 0);
  return (
    <TvBoard
      initial={{
        daily,
        yesterday,
        monthly,
        pipeline,
        allocation,
        gameDay,
        monthlyGoal,
        monthlyTotal,
        generatedAtISO: now.toISOString(),
      }}
    />
  );
}
