import { dailyBoard, monthlyBoard, pipelineBoard, yesterdayBoard } from "../../../db/queries/boards";
import { TvBoard } from "../../../components/TvBoard";

export const metadata = { title: "TV board" };
export const dynamic = "force-dynamic";

export default async function TvPage() {
  const now = new Date();
  const [daily, yesterday, monthly, pipeline] = await Promise.all([
    dailyBoard(now),
    yesterdayBoard(now),
    monthlyBoard(now),
    pipelineBoard(now),
  ]);
  return (
    <TvBoard initial={{ daily, yesterday, monthly, pipeline, generatedAtISO: now.toISOString() }} />
  );
}
