import { Board } from "../../components/Board";
import { getBoardsSnapshot } from "../../db/queries/boards-snapshot";
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
  const initial = await getBoardsSnapshot();

  const welcome = welcomeFlag === "1" && session ? greeting(session.name, sydneyToday(now)) : null;

  return <Board initial={initial} welcome={welcome} isManager={session?.role === "manager"} />;
}
