import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { AppShell } from "../../components/AppShell";
import { getSession } from "../../lib/session";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  return <AppShell session={session}>{children}</AppShell>;
}
