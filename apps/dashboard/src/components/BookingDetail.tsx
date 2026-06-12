"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { cx } from "@nlr/ui";

import { setDeleted, updateBooking } from "../app/actions/bookings";
import { AU_STATES, LEAD_SOURCES, STATUS_OPTIONS, SUBURBS } from "../lib/au-locations";
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

type FieldKind = "text" | "tel" | "email" | "date" | "number" | "suburb" | "textarea";

interface FieldDef {
  key: EditableField;
  label: string;
  kind?: FieldKind;
  options?: ReadonlyArray<readonly [string, string]> | ReadonlyArray<string>;
}

const SECTIONS: Array<{ title: string; fields: FieldDef[] }> = [
  {
    title: "Customer",
    fields: [
      { key: "customerName", label: "Name" },
      { key: "customerPhone", label: "Phone", kind: "tel" },
      { key: "customerEmail", label: "Email", kind: "email" },
      { key: "leadSource", label: "Lead from", options: LEAD_SOURCES },
    ],
  },
  {
    title: "Move",
    fields: [
      { key: "pickup", label: "Pickup suburb", kind: "suburb" },
      { key: "delivery", label: "Delivery suburb", kind: "suburb" },
      { key: "state", label: "State", options: AU_STATES },
      { key: "moveDate", label: "Move date", kind: "date" },
      { key: "beds", label: "Beds", kind: "number" },
      { key: "cubic", label: "Cubic", kind: "number" },
      { key: "men", label: "Men", kind: "number" },
    ],
  },
  {
    title: "Money",
    fields: [
      { key: "value", label: "Value $" },
      { key: "deposit", label: "Deposit $" },
      { key: "status", label: "Status", options: STATUS_OPTIONS },
    ],
  },
  {
    title: "Notes",
    fields: [{ key: "notes", label: "Internal notes", kind: "textarea" }],
  },
];

const inputCls =
  "min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-brand-950 shadow-sm transition-colors hover:border-slate-300 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-600 disabled:bg-slate-50 disabled:text-slate-400";
const labelCls = "mb-1 block text-xs font-semibold text-slate-500";

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
      setMessage(
        r.ok
          ? "Saved."
          : r.error === "forbidden"
            ? "Only the booking's rep or a manager can edit this."
            : "Couldn't save — check the values.",
      );
      if (r.ok) router.refresh();
    });
  };

  const toggleDeleted = () => {
    startTransition(async () => {
      await setDeleted(booking.id, !booking.deletedAt);
      router.refresh();
    });
  };

  const renderField = (f: FieldDef) => {
    const value = booking[f.key as keyof BookingRow];
    if (f.options) {
      const pairs: ReadonlyArray<readonly [string, string]> =
        typeof f.options[0] === "string"
          ? (f.options as ReadonlyArray<string>).map((o) => [o, o] as const)
          : (f.options as ReadonlyArray<readonly [string, string]>);
      return (
        <select
          id={`f-${f.key}`}
          name={f.key}
          defaultValue={String(value ?? "")}
          disabled={!canEdit}
          className={inputCls}
        >
          <option value="">—</option>
          {pairs.map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </select>
      );
    }
    if (f.kind === "textarea") {
      return (
        <textarea
          id={`f-${f.key}`}
          name={f.key}
          rows={3}
          defaultValue={booking.notes ?? ""}
          disabled={!canEdit}
          className={cx(inputCls, "py-2")}
        />
      );
    }
    return (
      <input
        id={`f-${f.key}`}
        name={f.key}
        type={f.kind === "suburb" ? "text" : (f.kind ?? "text")}
        list={f.kind === "suburb" ? "au-suburbs-detail" : undefined}
        placeholder={f.kind === "suburb" ? "Start typing…" : undefined}
        defaultValue={String(value ?? "")}
        disabled={!canEdit}
        className={inputCls}
      />
    );
  };

  return (
    <div className="max-w-3xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold tracking-[0.2em] text-slate-600 uppercase">
            Booking · entered by {repName}
          </p>
          <h1 className="font-display mt-1 text-5xl font-bold tracking-wide text-brand-900 uppercase">
            {booking.jobNumber}
          </h1>
        </div>
        <div className="text-right">
          <p className="text-xs font-medium text-slate-600">Record {completionPct}% complete</p>
          <div aria-hidden className="mt-1 h-1.5 w-40 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-accent-400 transition-all duration-700"
              style={{ width: `${completionPct}%` }}
            />
          </div>
        </div>
      </div>

      {booking.deletedAt && (
        <p
          role="alert"
          className="fade-in mt-4 rounded-xl border border-accent-500 bg-accent-50 px-3 py-2 text-sm font-semibold text-brand-900"
        >
          Deleted booking — hidden from lists and boards
        </p>
      )}
      {!canEdit && (
        <p className="mt-4 text-sm font-medium text-slate-500">
          Read-only — only {repName} or a manager can edit
        </p>
      )}
      {message && (
        <p
          role="status"
          className="fade-in mt-4 rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-900"
        >
          {message}
        </p>
      )}

      <div className="mt-6 space-y-4">
        {SECTIONS.map((section) => (
          <section
            key={section.title}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <h2 className="text-sm font-bold text-brand-900">{section.title}</h2>
            <form action={save} className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {section.fields.map((f) => (
                <div key={f.key} className={f.kind === "textarea" ? "sm:col-span-2" : undefined}>
                  <label htmlFor={`f-${f.key}`} className={labelCls}>
                    {f.label}
                  </label>
                  {renderField(f)}
                </div>
              ))}
              {canEdit && (
                <div className="sm:col-span-2">
                  <button
                    type="submit"
                    disabled={pending}
                    className="min-h-11 rounded-full bg-brand-900 px-6 text-sm font-semibold text-white shadow-sm transition-all hover:bg-brand-800 disabled:opacity-60 motion-safe:hover:-translate-y-0.5"
                  >
                    {pending ? "Saving…" : `Save ${section.title.toLowerCase()}`}
                  </button>
                </div>
              )}
            </form>
          </section>
        ))}
      </div>

      <datalist id="au-suburbs-detail">
        {SUBURBS.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>

      {isManager && (
        <button
          type="button"
          onClick={toggleDeleted}
          disabled={pending}
          className="mt-6 min-h-11 rounded-full border border-slate-200 bg-white px-5 text-sm font-semibold text-brand-800 transition-colors hover:border-brand-300"
        >
          {booking.deletedAt ? "Restore booking" : "Delete booking"}
        </button>
      )}

      <section className="mt-8">
        <h2 className="text-sm font-bold text-brand-900">Audit trail</h2>
        <ul className="mt-3 space-y-1">
          {audit.length === 0 && (
            <li className="text-sm text-slate-500">No changes recorded yet.</li>
          )}
          {audit.map((a) => (
            <li
              key={a.id}
              className="rounded-r-lg border-l-2 border-accent-400 bg-white py-1.5 pl-3 text-xs text-slate-500"
            >
              <span className="font-semibold text-brand-900">{a.staffId}</span> · {a.action} ·{" "}
              {new Date(a.atISO).toLocaleString("en-AU", { timeZone: "Australia/Sydney" })}
              {a.diff && Object.keys(a.diff).length > 0 && (
                <span className="block text-slate-500">
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
