import { getActionsSnapshot, type ActionsResponseDTO } from "../../../lib/movepro-actions";
import { ActionsBoard } from "../../../components/ActionsBoard";

export const metadata = { title: "Rep activity" };
export const dynamic = "force-dynamic";
export const maxDuration = 25;

function emptySnapshot(): ActionsResponseDTO {
  return { updatedAt: new Date().toISOString(), daily: [], monthly: [] };
}

/**
 * Wall-display activity leaderboard — calls/emails/messages per rep, sourced
 * from MovePro's Metabase report. Same pattern as /live: server-rendered
 * initial snapshot, then ActionsBoard polls /api/actions for live updates.
 */
export default async function ActionsPage() {
  const initial = await getActionsSnapshot().catch((err: unknown) => {
    console.error("ActionsPage initial fetch failed:", err);
    return emptySnapshot();
  });
  return <ActionsBoard initial={initial} />;
}
