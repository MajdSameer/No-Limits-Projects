import { getBoardsSnapshot } from "../../../db/queries/boards-snapshot";
import { TvBoard } from "../../../components/TvBoard";

export const metadata = { title: "TV board" };
export const dynamic = "force-dynamic";

export default async function TvPage() {
  const initial = await getBoardsSnapshot();
  return <TvBoard initial={initial} />;
}
