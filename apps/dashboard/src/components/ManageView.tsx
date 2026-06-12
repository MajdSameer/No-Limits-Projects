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
  "min-h-9 border border-brand-900 px-2 py-1 font-mono text-[0.6rem] font-bold tracking-widest uppercase hover:bg-manila-200 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-600";

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
      <p className="font-mono text-xs font-bold tracking-[0.3em] text-accent-400 uppercase">Managers only</p>
      <h1 className="font-display mt-1 text-4xl font-bold tracking-wide text-manila-100 uppercase">Manage</h1>

      {message && (
        <p role="alert" className="mt-4 border border-accent-400 bg-ink-900 px-3 py-2 text-sm font-semibold text-accent-300">
          {message}
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <a href="/manage/export?what=bookings" className={cx(btn, "border-brand-700 bg-ink-900 text-manila-200 hover:bg-ink-950")}>
          ⬇ Bookings CSV
        </a>
        <a href="/manage/export?what=timesheets" className={cx(btn, "border-brand-700 bg-ink-900 text-manila-200 hover:bg-ink-950")}>
          ⬇ Timesheets CSV
        </a>
        <a href="/manage/export?what=audit" className={cx(btn, "border-brand-700 bg-ink-900 text-manila-200 hover:bg-ink-950")}>
          ⬇ Audit CSV
        </a>
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full border-collapse bg-manila-100 text-sm text-brand-950">
          <thead>
            <tr className="border-b-2 border-brand-950 text-left font-mono text-[0.6rem] tracking-[0.2em] text-brand-700 uppercase">
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
              <tr key={s.id} className={cx("border-b border-manila-400", !s.active && "opacity-50")}>
                <th scope="row" className="px-3 py-2 text-left font-bold">{s.name}</th>
                <td className="px-3 py-2 font-mono text-xs uppercase">{s.role}</td>
                <td className="px-3 py-2 font-mono text-xs">
                  {!s.active ? "inactive" : s.locked ? <span className="border border-brand-900 px-1.5 py-0.5 font-bold">LOCKED</span> : "active"}
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
          <label htmlFor="new-name" className="mb-1 block font-mono text-[0.6rem] font-bold tracking-[0.25em] text-brand-300 uppercase">
            Add staff
          </label>
          <input id="new-name" name="name" required placeholder="Full name" className="min-h-11 border border-brand-800 bg-ink-900 px-3 text-manila-100 placeholder:text-brand-700" />
        </div>
        <label className="sr-only" htmlFor="new-role">Role</label>
        <select id="new-role" name="role" className="min-h-11 border border-brand-800 bg-ink-900 px-2 text-manila-100">
          <option value="rep">Rep</option>
          <option value="manager">Manager</option>
        </select>
        <button type="submit" disabled={pending} className="min-h-11 rounded-full bg-accent-400 px-5 font-mono text-xs font-bold tracking-widest text-ink-950 uppercase hover:bg-accent-300">
          Add
        </button>
        <p className="basis-full font-mono text-[0.6rem] tracking-widest text-brand-300 uppercase">
          New reps start with PIN 1234 (managers 123456) — reset immediately.
        </p>
      </form>

      <section className="mt-10">
        <h2 className="font-mono text-[0.65rem] font-bold tracking-[0.3em] text-brand-300 uppercase">
          Audit log (latest 100)
        </h2>
        <ul className="mt-3 max-h-96 space-y-1 overflow-y-auto">
          {audit.map((a) => (
            <li key={a.id} className="border-l-2 border-brand-800 py-1 pl-3 font-mono text-xs text-brand-300">
              <span className="text-manila-200">{a.staffId}</span> · {a.action} · {a.entity}/{a.entityId} ·{" "}
              {new Date(a.atISO).toLocaleString("en-AU", { timeZone: "Australia/Sydney" })}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
