import Link from "next/link";

import { cx } from "@nlr/ui";

import { subcontractorBookings } from "../../../db/queries/bookings";
import { requireSession } from "../../../lib/session";

export const metadata = { title: "Subcontractor" };
export const dynamic = "force-dynamic";

const TABS: Array<{ key: "day" | "month"; label: string }> = [
  { key: "day", label: "Daily" },
  { key: "month", label: "This month" },
];

export default async function SubcontractorPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  await requireSession();
  const params = await searchParams;
  const tab = (TABS.some((t) => t.key === params.tab) ? params.tab : "day") as "day" | "month";
  const rows = await subcontractorBookings(tab);
  const totalDeposit = rows.reduce((s, r) => s + Number(r.booking.deposit ?? 0), 0);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
            Subcontractor
          </p>
          <h1 className="mt-1 text-4xl font-bold tracking-tight text-brand-900">Domanic&rsquo;s jobs</h1>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-brand-900 tabular-nums">{rows.length}</div>
          <div className="text-xs text-slate-500">jobs · ${totalDeposit.toLocaleString()} deposits</div>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/subcontractor?tab=${t.key}`}
            className={cx(
              "rounded-full px-4 py-2 text-sm font-semibold",
              t.key === tab ? "bg-brand-900 text-white" : "bg-slate-100 text-slate-700",
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="mt-6 rounded-xl bg-slate-50 p-6 text-slate-500">
          No subcontractor jobs {tab === "day" ? "today" : "this month"} yet.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200">
          {rows.map(({ booking: b }) => (
            <li key={b.id}>
              <Link
                href={`/bookings/${b.id}`}
                className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-slate-50"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-brand-900">
                    {b.customerName ?? "—"}{" "}
                    <span className="font-mono text-sm text-slate-500">{b.jobNumber}</span>
                  </div>
                  <div className="truncate text-sm text-slate-500">
                    {[b.pickup, b.delivery].filter(Boolean).join(" → ") || b.state || ""}
                  </div>
                </div>
                <div className="shrink-0 text-right text-sm tabular-nums">
                  <div className="font-medium text-brand-900">{b.moveDate}</div>
                  {b.deposit != null && <div className="text-slate-500">${b.deposit} dep</div>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
