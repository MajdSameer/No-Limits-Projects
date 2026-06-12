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
          <p className="font-mono text-xs font-bold tracking-[0.3em] text-accent-400 uppercase">Bookings</p>
          <h1 className="font-display mt-1 text-4xl font-bold tracking-wide text-manila-100 uppercase">
            The book
          </h1>
        </div>
        <form className="flex gap-2" action="/bookings" method="GET">
          <input type="hidden" name="filter" value={filter} />
          <label htmlFor="q" className="sr-only">Search bookings</label>
          <input
            id="q"
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="Job #, customer, suburb…"
            className="min-h-11 w-64 border border-brand-800 bg-ink-900 px-3 text-manila-100 placeholder:text-brand-700 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent-400"
          />
          <button type="submit" className="min-h-11 rounded-full border border-brand-700 px-4 font-mono text-xs font-bold tracking-widest text-manila-200 uppercase hover:border-accent-400">
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
              "min-h-11 rounded-full border px-4 py-2.5 font-mono text-xs font-bold tracking-widest uppercase",
              filter === f.key
                ? "border-accent-400 bg-accent-400 text-ink-950"
                : "border-brand-800 text-manila-200 hover:border-accent-400",
            )}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <p className="mt-10 font-mono text-sm tracking-widest text-brand-300 uppercase">
          Nothing here yet — hit + Job to log the first one 🎉
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full border-collapse bg-manila-100 text-sm text-brand-950">
            <thead>
              <tr className="border-b-2 border-brand-950 text-left font-mono text-[0.6rem] tracking-[0.2em] text-brand-700 uppercase">
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
                <tr key={booking.id} className="border-b border-manila-400 hover:bg-manila-200">
                  <td className="px-3 py-2.5 font-mono font-bold">
                    <Link href={`/bookings/${booking.id}`} className="underline decoration-accent-500 decoration-2 underline-offset-2">
                      {booking.jobNumber}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5">{booking.customerName ?? "—"}</td>
                  <td className="max-w-56 truncate px-3 py-2.5">
                    {booking.pickup || booking.delivery ? `${booking.pickup ?? "?"} → ${booking.delivery ?? "?"}` : "—"}
                  </td>
                  <td className="px-3 py-2.5">{repName}</td>
                  <td className="px-3 py-2.5">
                    <span className="border border-brand-900 px-2 py-0.5 font-mono text-[0.6rem] font-bold tracking-widest uppercase">
                      {TYPE_CHIP[booking.type]}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 font-mono">{booking.moveDate}</td>
                  <td className="px-3 py-2.5 font-mono">{booking.value ? `$${booking.value}` : "—"}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div aria-hidden className="h-1.5 w-16 bg-manila-400">
                        <div className="h-full bg-brand-900" style={{ width: `${completion}%` }} />
                      </div>
                      <span className="font-mono text-xs">{completion}%</span>
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
