import Link from "next/link";

import { cx } from "@nlr/ui";

import { searchBookings, type BookingFilters } from "../../../db/queries/bookings";
import { requireSession } from "../../../lib/session";

export const metadata = { title: "Bookings" };
export const dynamic = "force-dynamic";

const FILTERS: Array<{ key: NonNullable<BookingFilters["filter"]>; label: string }> = [
  { key: "today", label: "Today" },
  { key: "week", label: "This week" },
  { key: "incomplete", label: "Incomplete" },
  { key: "mine", label: "Mine" },
  { key: "all", label: "All" },
];

const TYPE_CHIP: Record<string, string> = {
  moving: "Moving",
  storage: "Storage",
  cleaning: "Cleaning",
  car: "Car",
};

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: string }>;
}) {
  const session = await requireSession();
  const params = await searchParams;
  const filter = (FILTERS.some((f) => f.key === params.filter) ? params.filter : "today") as NonNullable<
    BookingFilters["filter"]
  >;
  const rows = await searchBookings({ q: params.q, filter, staffId: session.staffId });

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">Bookings</p>
          <h1 className="mt-1 text-4xl font-bold tracking-tight text-brand-900">The book</h1>
        </div>
        <form className="flex gap-2" action="/bookings" method="GET">
          <input type="hidden" name="filter" value={filter} />
          <label htmlFor="q" className="sr-only">Search bookings</label>
          <input
            id="q"
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="Job #, customer, suburb…"
            className="min-h-11 w-64 rounded-xl border border-slate-200 bg-white px-3 text-brand-950 shadow-sm transition-colors placeholder:text-slate-400 hover:border-slate-300 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-600"
          />
          <button type="submit" className="min-h-11 rounded-full bg-brand-900 px-5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-brand-800">
            Search
          </button>
        </form>
      </div>

      <nav aria-label="Filters" className="mt-5 flex flex-wrap gap-1">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={`/bookings?filter=${f.key}${params.q ? `&q=${encodeURIComponent(params.q)}` : ""}`}
            aria-current={filter === f.key ? "page" : undefined}
            className={cx(
              "min-h-10 rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200",
              filter === f.key
                ? "bg-brand-900 text-white shadow-sm"
                : "border border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:text-brand-900",
            )}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <p className="mt-10 text-sm font-medium text-slate-500">
          Nothing here yet — hit + Job to log the first one 🎉
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full border-collapse text-sm text-brand-950">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold text-slate-500">
                <th className="px-3 py-2">Job #</th>
                <th className="px-3 py-2">Customer</th>
                <th className="px-3 py-2">Route</th>
                <th className="px-3 py-2">Rep</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Move date</th>
                <th className="px-3 py-2">Value</th>
                <th className="px-3 py-2">Complete</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ booking, repName, completion }) => (
                <tr key={booking.id} className="border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50">
                  <td className="px-3 py-2.5 font-mono font-bold">
                    <Link href={`/bookings/${booking.id}`} className="font-semibold text-brand-800 underline decoration-accent-400 decoration-2 underline-offset-2 transition-colors hover:text-brand-600">
                      {booking.jobNumber}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5">{booking.customerName ?? "—"}</td>
                  <td className="max-w-56 truncate px-3 py-2.5">
                    {booking.pickup || booking.delivery ? `${booking.pickup ?? "?"} → ${booking.delivery ?? "?"}` : "—"}
                  </td>
                  <td className="px-3 py-2.5">{repName}</td>
                  <td className="px-3 py-2.5">
                    <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[0.65rem] font-bold tracking-wide text-brand-700 uppercase">
                      {TYPE_CHIP[booking.type]}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 font-mono">{booking.moveDate}</td>
                  <td className="px-3 py-2.5 font-mono">{booking.value ? `$${booking.value}` : "—"}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div aria-hidden className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-200">
                        <div className="h-full rounded-full bg-accent-400" style={{ width: `${completion}%` }} />
                      </div>
                      <span className="text-xs text-slate-500">{completion}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
