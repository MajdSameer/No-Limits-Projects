"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { cx } from "@nlr/ui";

import {
  addStaff,
  setActive,
  setGoal,
  setIntakeWeight,
  setPin,
  unlockStaff,
} from "../app/actions/manage";

interface StaffRow {
  id: string;
  name: string;
  role: "rep" | "manager";
  active: boolean;
  locked: boolean;
  intakeWeight: number;
  goal: number | null;
}

interface AuditRow {
  id: string;
  staffId: string;
  action: string;
  entity: string;
  entityId: string;
  atISO: string;
}

const btn =
  "min-h-9 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 transition-colors hover:border-brand-300 hover:text-brand-900 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-600";

export function ManageView({ staff, audit }: { staff: StaffRow[]; audit: AuditRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const run = (fn: () => Promise<{ error?: string }>) => {
    setMessage(null);
    startTransition(async () => {
      const r = await fn();
      if (r.error) setMessage(r.error);
      router.refresh();
    });
  };

  const promptGoal = (s: StaffRow) => {
    const raw = window.prompt(`Daily goal for ${s.name}:`, String(s.goal ?? 5));
    if (raw === null) return;
    run(() => setGoal(s.id, Number(raw)));
  };
  const promptWeight = (s: StaffRow) => {
    const raw = window.prompt(`Lead intake weight for ${s.name} (0–3):`, String(s.intakeWeight));
    if (raw === null) return;
    run(() => setIntakeWeight(s.id, Number(raw)));
  };
  const promptPin = (s: StaffRow) => {
    const raw = window.prompt(`New PIN for ${s.name} (4–6 digits):`);
    if (raw === null) return;
    run(() => setPin(s.id, raw.trim()));
  };

  const submitAdd = (formData: FormData) => {
    run(() => addStaff(String(formData.get("name")), formData.get("role") === "manager" ? "manager" : "rep"));
  };

  return (
    <div>
      <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">Managers only</p>
      <h1 className="mt-1 text-4xl font-bold tracking-tight text-brand-900">Manage</h1>

      {message && (
        <p role="alert" className="fade-in mt-4 rounded-xl border border-accent-500 bg-accent-50 px-3 py-2 text-sm font-semibold text-brand-900">
          {message}
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <a href="/manage/export?what=bookings" className={cx(btn, "shadow-sm")}>
          ⬇ Bookings CSV
        </a>
        <a href="/manage/export?what=timesheets" className={cx(btn, "shadow-sm")}>
          ⬇ Timesheets CSV
        </a>
        <a href="/manage/export?what=audit" className={cx(btn, "shadow-sm")}>
          ⬇ Audit CSV
        </a>
      </div>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full border-collapse text-sm text-brand-950">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold text-slate-500">
              <th className="px-3 py-2">Staff</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Daily goal</th>
              <th className="px-3 py-2">Intake weight</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {staff.map((s) => (
              <tr key={s.id} className={cx("border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50", !s.active && "opacity-50")}>
                <th scope="row" className="px-3 py-2 text-left font-bold">{s.name}</th>
                <td className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase">{s.role}</td>
                <td className="px-3 py-2 text-xs text-slate-600">
                  {!s.active ? "inactive" : s.locked ? <span className="rounded-full bg-accent-100 px-2 py-0.5 font-bold text-brand-900">LOCKED</span> : "active"}
                </td>
                <td className="px-3 py-2">
                  <button type="button" onClick={() => promptGoal(s)} disabled={pending} className={btn}>
                    {s.goal ?? "—"} ✎
                  </button>
                </td>
                <td className="px-3 py-2">
                  <button type="button" onClick={() => promptWeight(s)} disabled={pending} className={btn}>
                    {s.intakeWeight.toFixed(1)} ✎
                  </button>
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    <button type="button" onClick={() => promptPin(s)} disabled={pending} className={btn}>Reset PIN</button>
                    {s.locked && (
                      <button type="button" onClick={() => run(() => unlockStaff(s.id))} disabled={pending} className={btn}>Unlock</button>
                    )}
                    <button type="button" onClick={() => run(() => setActive(s.id, !s.active))} disabled={pending} className={btn}>
                      {s.active ? "Deactivate" : "Reactivate"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form action={submitAdd} className="mt-4 flex flex-wrap items-end gap-2">
        <div>
          <label htmlFor="new-name" className="mb-1 block text-xs font-semibold text-slate-500">
            Add staff
          </label>
          <input id="new-name" name="name" required placeholder="Full name" className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-brand-950 shadow-sm placeholder:text-slate-400" />
        </div>
        <label className="sr-only" htmlFor="new-role">Role</label>
        <select id="new-role" name="role" className="min-h-11 rounded-xl border border-slate-200 bg-white px-2 text-brand-950 shadow-sm">
          <option value="rep">Rep</option>
          <option value="manager">Manager</option>
        </select>
        <button type="submit" disabled={pending} className="min-h-11 rounded-full bg-brand-900 px-5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-brand-800 motion-safe:hover:-translate-y-0.5">
          Add
        </button>
        <p className="basis-full text-xs text-slate-500">
          New reps start with PIN 1234 (managers 123456) — reset immediately.
        </p>
      </form>

      <section className="mt-10">
        <h2 className="text-sm font-bold text-brand-900">Audit log (latest 100)</h2>
        <ul className="mt-3 max-h-96 space-y-1 overflow-y-auto">
          {audit.map((a) => (
            <li key={a.id} className="rounded-r-lg border-l-2 border-accent-400 bg-white py-1.5 pl-3 text-xs text-slate-500">
              <span className="font-semibold text-brand-900">{a.staffId}</span> · {a.action} · {a.entity}/{a.entityId} ·{" "}
              {new Date(a.atISO).toLocaleString("en-AU", { timeZone: "Australia/Sydney" })}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
