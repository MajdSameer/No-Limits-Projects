"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { cx } from "@nlr/ui";

import { setDeleted, updateBooking } from "../app/actions/bookings";
import type { EditableField } from "../lib/bookings-shared";

interface BookingRow {
  id: string;
  jobNumber: string;
  company: string;
  type: string;
  status: string;
  customerName: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  pickup: string | null;
  delivery: string | null;
  state: string | null;
  moveDate: string;
  value: string | null;
  deposit: string | null;
  beds: number | null;
  cubic: number | null;
  men: number | null;
  leadSource: string | null;
  notes: string | null;
  enteredAt: Date;
  deletedAt: Date | null;
}

interface AuditRow {
  id: string;
  staffId: string;
  action: string;
  atISO: string;
  diff: Record<string, { from: unknown; to: unknown }> | null;
}

const SECTIONS: Array<{ title: string; fields: Array<{ key: EditableField; label: string; type?: string }> }> = [
  {
    title: "Customer",
    fields: [
      { key: "customerName", label: "Name" },
      { key: "customerPhone", label: "Phone", type: "tel" },
      { key: "customerEmail", label: "Email", type: "email" },
      { key: "leadSource", label: "Lead from" },
    ],
  },
  {
    title: "Move",
    fields: [
      { key: "pickup", label: "Pickup" },
      { key: "delivery", label: "Delivery" },
      { key: "state", label: "State" },
      { key: "moveDate", label: "Move date", type: "date" },
      { key: "beds", label: "Beds", type: "number" },
      { key: "cubic", label: "Cubic", type: "number" },
      { key: "men", label: "Men", type: "number" },
    ],
  },
  {
    title: "Money",
    fields: [
      { key: "value", label: "Value $" },
      { key: "deposit", label: "Deposit $" },
      { key: "status", label: "Status" },
    ],
  },
  {
    title: "Notes",
    fields: [{ key: "notes", label: "Internal notes" }],
  },
];

const inputCls =
  "min-h-11 w-full border border-manila-400 bg-white px-3 text-brand-950 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-600";

export function BookingDetail({
  booking,
  repName,
  completionPct,
  canEdit,
  isManager,
  audit,
}: {
  booking: BookingRow;
  repName: string;
  completionPct: number;
  canEdit: boolean;
  isManager: boolean;
  audit: AuditRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const save = (formData: FormData) => {
    const patch: Partial<Record<EditableField, string>> = {};
    for (const [k, v] of formData.entries()) patch[k as EditableField] = String(v);
    setMessage(null);
    startTransition(async () => {
      const r = await updateBooking(booking.id, patch);
      setMessage(r.ok ? "Saved." : r.error === "forbidden" ? "Only the booking's rep or a manager can edit this." : "Couldn't save — check the values.");
      if (r.ok) router.refresh();
    });
  };

  const toggleDeleted = () => {
    startTransition(async () => {
      await setDeleted(booking.id, !booking.deletedAt);
      router.refresh();
    });
  };

  return (
    <div className="max-w-3xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs font-bold tracking-[0.3em] text-accent-400 uppercase">
            Booking · entered by {repName}
          </p>
          <h1 className="font-display mt-1 text-5xl font-bold tracking-wide text-manila-100 uppercase">
            {booking.jobNumber}
          </h1>
        </div>
        <div className="text-right">
          <p className="font-mono text-xs tracking-widest text-brand-300 uppercase">Record {completionPct}% complete</p>
          <div aria-hidden className="mt-1 h-1.5 w-40 bg-ink-900">
            <div className="h-full bg-accent-400" style={{ width: `${completionPct}%` }} />
          </div>
        </div>
      </div>

      {booking.deletedAt && (
        <p role="alert" className="mt-4 border-2 border-accent-400 bg-ink-900 px-3 py-2 font-mono text-xs tracking-widest text-accent-300 uppercase">
          Deleted booking — hidden from lists and boards
        </p>
      )}
      {!canEdit && (
        <p className="mt-4 font-mono text-xs tracking-widest text-brand-300 uppercase">
          Read-only — only {repName} or a manager can edit
        </p>
      )}
      {message && (
        <p role="status" className="mt-4 border border-accent-400 bg-ink-900 px-3 py-2 text-sm font-semibold text-accent-300">
          {message}
        </p>
      )}

      <div className="mt-6 space-y-4">
        {SECTIONS.map((section) => (
          <section key={section.title} className="bg-manila-100 p-5">
            <h2 className="font-mono text-[0.65rem] font-bold tracking-[0.3em] text-brand-700 uppercase">
              {section.title}
            </h2>
            <form action={save} className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {section.fields.map((f) => (
                <div key={f.key} className={f.key === "notes" ? "sm:col-span-2" : undefined}>
                  <label htmlFor={`f-${f.key}`} className="mb-1 block font-mono text-[0.6rem] font-bold tracking-[0.25em] text-brand-700 uppercase">
                    {f.label}
                  </label>
                  {f.key === "notes" ? (
                    <textarea id={`f-${f.key}`} name={f.key} rows={3} defaultValue={booking.notes ?? ""} disabled={!canEdit} className={cx(inputCls, "py-2")} />
                  ) : (
                    <input
                      id={`f-${f.key}`}
                      name={f.key}
                      type={f.type ?? "text"}
                      defaultValue={String(booking[f.key as keyof BookingRow] ?? "")}
                      disabled={!canEdit}
                      className={inputCls}
                    />
                  )}
                </div>
              ))}
              {canEdit && (
                <div className="sm:col-span-2">
                  <button type="submit" disabled={pending} className="min-h-11 rounded-full bg-brand-900 px-6 font-mono text-xs font-bold tracking-widest text-white uppercase hover:bg-brand-800 disabled:opacity-60">
                    {pending ? "Saving…" : `Save ${section.title.toLowerCase()}`}
                  </button>
                </div>
              )}
            </form>
          </section>
        ))}
      </div>

      {isManager && (
        <button type="button" onClick={toggleDeleted} disabled={pending} className="mt-6 min-h-11 rounded-full border border-accent-400 px-5 font-mono text-xs font-bold tracking-widest text-accent-300 uppercase hover:bg-ink-900">
          {booking.deletedAt ? "Restore booking" : "Delete booking"}
        </button>
      )}

      <section className="mt-8">
        <h2 className="font-mono text-[0.65rem] font-bold tracking-[0.3em] text-brand-300 uppercase">Audit trail</h2>
        <ul className="mt-3 space-y-1">
          {audit.length === 0 && <li className="text-sm text-brand-300">No changes recorded yet.</li>}
          {audit.map((a) => (
            <li key={a.id} className="border-l-2 border-brand-800 py-1 pl-3 font-mono text-xs text-brand-300">
              <span className="text-manila-200">{a.staffId}</span> · {a.action} ·{" "}
              {new Date(a.atISO).toLocaleString("en-AU", { timeZone: "Australia/Sydney" })}
              {a.diff && Object.keys(a.diff).length > 0 && (
                <span className="block text-brand-300">
                  {Object.entries(a.diff)
                    .map(([k, v]) => `${k}: ${String(v.from ?? "—")} → ${String(v.to ?? "—")}`)
                    .join(" · ")}
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
