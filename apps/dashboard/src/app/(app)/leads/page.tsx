import { leadInbox } from "../../../db/queries/lead-inbox";
import { requireSession } from "../../../lib/session";

export const metadata = { title: "Leads" };
export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  await requireSession();
  const rows = await leadInbox();
  const awaiting = rows.filter((r) => !r.allocatedTo).length;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">Leads</p>
          <h1 className="mt-1 text-4xl font-bold tracking-tight text-brand-900">Lead inbox</h1>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-brand-900 tabular-nums">{rows.length}</div>
          <div className="text-xs text-slate-500">
            recent · {awaiting} awaiting a rep
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="mt-6 rounded-xl bg-slate-50 p-6 text-slate-500">
          No leads yet. Incoming quote leads land here and are auto-allocated to whoever&rsquo;s next up.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-4 px-4 py-3">
              <div className="min-w-0">
                <div className="font-semibold text-brand-900">
                  {r.contactName ?? "Unknown"}
                  {r.source && <span className="ml-2 text-sm text-slate-500">· {r.source}</span>}
                </div>
                <div className="truncate text-sm text-slate-500">
                  {[r.phone, r.email].filter(Boolean).join(" · ") || r.details || ""}
                </div>
              </div>
              <div className="shrink-0 text-right">
                {r.allocatedTo ? (
                  <span className="rounded-full bg-accent-100 px-3 py-1 text-sm font-semibold text-brand-900">
                    {r.repName ?? r.allocatedTo}
                  </span>
                ) : (
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-500">
                    awaiting
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
