import { getActionsSnapshot, type ActionsResponseDTO } from "../../../lib/movepro-actions";
import { getUnseenSnapshot, type UnseenResponseDTO } from "../../../lib/movepro-unseen";
import { ActionsBoard } from "../../../components/ActionsBoard";

export const metadata = { title: "Rep activity" };
export const dynamic = "force-dynamic";
// Matches /api/actions's maxDuration — see that file for why 60s. The
// unseen-communications fetch alongside it is a single ~2s query, well
// within the same budget.
export const maxDuration = 60;

function emptyActivity(): ActionsResponseDTO {
  return { updatedAt: new Date().toISOString(), daily: [], monthly: [], yesterdayTop: null };
}

function emptyUnseen(): UnseenResponseDTO {
  return { updatedAt: new Date().toISOString(), rows: [] };
}

/**
 * Wall-display rotating board — alternates between the activity leaderboard
 * (view 1) and the unseen-communications board (view 2), both sourced from
 * MovePro's Metabase reports. Same pattern as /live: server-rendered initial
 * snapshots for both views, then ActionsBoard polls both /api/actions and
 * /api/unseen in the background regardless of which view is showing.
 */
export default async function ActionsPage() {
  const [activity, unseen] = await Promise.all([
    getActionsSnapshot().catch((err: unknown) => {
      console.error("ActionsPage activity fetch failed:", err);
      return emptyActivity();
    }),
    getUnseenSnapshot().catch((err: unknown) => {
      console.error("ActionsPage unseen fetch failed:", err);
      return emptyUnseen();
    }),
  ]);
  return <ActionsBoard initialActivity={activity} initialUnseen={unseen} />;
}
