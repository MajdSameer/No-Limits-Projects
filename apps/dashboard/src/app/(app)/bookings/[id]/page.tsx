import { notFound } from "next/navigation";

import { bookingAudit, completion, getBooking } from "../../../../db/queries/bookings";
import { requireSession } from "../../../../lib/session";
import { BookingDetail } from "../../../../components/BookingDetail";

export const metadata = { title: "Booking" };
export const dynamic = "force-dynamic";

export default async function BookingPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;
  const row = await getBooking(id);
  if (!row) notFound();

  const audit = await bookingAudit(id);
  const canEdit = session.role === "manager" || row.booking.salesRepId === session.staffId;

  return (
    <BookingDetail
      booking={row.booking}
      repName={row.repName}
      completionPct={completion(row.booking)}
      canEdit={canEdit}
      isManager={session.role === "manager"}
      audit={audit.map((a) => ({
        id: a.id,
        staffId: a.staffId,
        action: a.action,
        atISO: a.at.toISOString(),
        diff: a.diff as Record<string, { from: unknown; to: unknown }> | null,
      }))}
    />
  );
}
