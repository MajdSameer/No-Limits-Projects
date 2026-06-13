import { AllocationView } from "../../../components/AllocationView";
import { allocationView } from "../../../db/queries/allocation";
import { getSession } from "../../../lib/session";

export const metadata = { title: "Allocation" };
export const dynamic = "force-dynamic";

export default async function AllocationPage() {
  const session = await getSession();
  const view = await allocationView();
  return <AllocationView initial={view} isManager={session?.role === "manager"} />;
}
