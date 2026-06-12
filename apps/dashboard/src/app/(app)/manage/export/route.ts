import { NextResponse, type NextRequest } from "next/server";
import { asc, desc, eq } from "drizzle-orm";

import { getDb, schema } from "../../../../db/client";
import { dayStates } from "../../../../db/queries/timesheet";
import { toCsv } from "../../../../lib/csv";
import { getSession } from "../../../../lib/session";
import { sydneyDayRange } from "../../../../lib/sydney";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "manager") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const what = request.nextUrl.searchParams.get("what") ?? "bookings";
  const db = await getDb();

  if (what === "bookings") {
    const rows = await db
      .select({ b: schema.bookings, rep: schema.staff.name })
      .from(schema.bookings)
      .innerJoin(schema.staff, eq(schema.bookings.salesRepId, schema.staff.id))
      .orderBy(desc(schema.bookings.enteredAt))
      .limit(10000);
    const csv = toCsv(
      [
        "job_number", "company", "type", "status", "customer_name", "customer_phone",
        "customer_email", "pickup", "delivery", "state", "move_date", "value", "deposit",
        "beds", "cubic", "men", "lead_source", "notes", "sales_rep", "entered_at", "deleted",
      ],
      rows.map(({ b, rep }) => [
        b.jobNumber, b.company, b.type, b.status, b.customerName, b.customerPhone,
        b.customerEmail, b.pickup, b.delivery, b.state, b.moveDate, b.value, b.deposit,
        b.beds, b.cubic, b.men, b.leadSource, b.notes, rep, b.enteredAt.toISOString(),
        b.deletedAt ? "yes" : "",
      ]),
    );
    return new NextResponse(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": 'attachment; filename="bookings.csv"',
      },
    });
  }

  if (what === "timesheets") {
    // Last 14 Sydney days, one row per staff per day with activity.
    const lines: unknown[][] = [];
    for (let back = 13; back >= 0; back--) {
      const day = new Date(Date.now() - back * 864e5);
      const range = sydneyDayRange(day);
      const states = await dayStates(range, range.end);
      for (const s of states) {
        if (s.status === "off") continue;
        lines.push([
          range.start.toISOString().slice(0, 10),
          s.name,
          s.status,
          (s.workedMs / 36e5).toFixed(2),
          (s.breakMs / 36e5).toFixed(2),
          s.lateMins ?? "",
          s.autoClosed ? "yes" : "",
        ]);
      }
    }
    const csv = toCsv(["day_utc_start", "staff", "status", "worked_hours", "break_hours", "late_mins", "auto_closed"], lines);
    return new NextResponse(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": 'attachment; filename="timesheets.csv"',
      },
    });
  }

  if (what === "audit") {
    const rows = await db.select().from(schema.auditLog).orderBy(desc(schema.auditLog.at)).limit(10000);
    const csv = toCsv(
      ["at", "staff", "action", "entity", "entity_id", "diff"],
      rows.map((a) => [a.at.toISOString(), a.staffId, a.action, a.entity, a.entityId, a.diff ? JSON.stringify(a.diff) : ""]),
    );
    return new NextResponse(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": 'attachment; filename="audit.csv"',
      },
    });
  }

  return NextResponse.json({ error: "unknown export" }, { status: 400 });
}

// Keep import used (asc referenced for potential ordering tweaks).
void asc;
