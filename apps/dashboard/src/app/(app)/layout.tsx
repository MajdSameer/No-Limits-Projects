import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { todaysEvents } from "../../db/queries/clock";
import { AppShell } from "../../components/AppShell";
import { ClockBar } from "../../components/ClockBar";
import { deriveClock, nextActions } from "../../lib/clock";
import { getSession } from "../../lib/session";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const events = await todaysEvents(session.staffId);
  const state = deriveClock(events, new Date());

  return (
    <AppShell session={session}>
      {children}
      <ClockBar
        status={state.status}
        sinceISO={state.since?.toISOString() ?? null}
        workedMs={state.workedMs}
        actions={nextActions(events)}
      />
    </AppShell>
  );
}
