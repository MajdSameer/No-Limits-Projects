import { Board } from "../../components/Board";
import { dailyBoard, monthlyBoard, pipelineBoard, yesterdayBoard } from "../../db/queries/boards";

export const dynamic = "force-dynamic";

export default async function BoardPage() {
  const now = new Date();
  const [daily, yesterday, monthly, pipeline] = await Promise.all([
    dailyBoard(now),
    yesterdayBoard(now),
    monthlyBoard(now),
    pipelineBoard(now),
  ]);

  return (
    <Board
      initial={{ daily, yesterday, monthly, pipeline, generatedAtISO: now.toISOString() }}
    />
  );
}
