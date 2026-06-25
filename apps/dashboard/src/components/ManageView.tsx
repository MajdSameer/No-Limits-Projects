"use client";

import { useOptimistic, useState, useTransition } from "react";

import { cx } from "@nlr/ui";

import {
  addStaff,
  setActive,
  setGender,
  setGoal,
  setIntakeWeight,
  setMonthlyGoal,
  setOnShift,
  setPin,
  setTeam,
  unlockStaff,
} from "../app/actions/manage";

interface ShiftRow {
  staffId: string;
  name: string;
  goal: number | null;
  gender: "f" | "m" | "x";
  onShift: boolean;
  fromSheet: boolean;
  overridden: boolean;
}

interface StaffRow {
  id: string;
  name: string;
  role: "rep" | "manager";
  active: boolean;
  locked: boolean;
  intakeWeight: number;
  goal: number | null;
  gender: "f" | "m" | "x";
  team: "orange" | "blue" | null;
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

export function ManageView({
  staff,
  audit,
  monthlyGoal,
  shifts,
}: {
  staff: StaffRow[];
  audit: AuditRow[];
  monthlyGoal: number;
  shifts: ShiftRow[];
}) {
  const [, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  // Optimistic staff list: an edit (team, gender, goal, status…) shows instantly,
  // then reconciles when the server action's revalidate refreshes the page —
  // mirrors the on-shift toggles below, and keeps the controlled <select>s from
  // snapping back to their old value while the write is in flight.
  const [optimisticStaff, patchStaff] = useOptimistic(
    staff,
    (cur, u: { id: string; patch: Partial<StaffRow> }) =>
      cur.map((s) => (s.id === u.id ? { ...s, ...u.patch } : s)),
  );

  // Run a mutation inside a transition, applying an optional optimistic patch
  // first so the UI updates immediately. The server action's revalidatePath
  // refreshes the page data when it returns, so there's no need for a manual
  // router.refresh() — that was a second full server re-render, and disabling the
  // controls through it is what made the page freeze on every change.
  const run = (fn: () => Promise<{ error?: string }>, optimistic?: () => void) => {
    setMessage(null);
    startTransition(async () => {
      if (optimistic) optimistic();
      const r = await fn();
      if (r.error) setMessage(r.error);
    });
  };

  const promptGoal = (s: StaffRow) => {
    const raw = window.prompt(`Daily goal for ${s.name}:`, String(s.goal ?? 5));
    if (raw === null) return;
    const g = Number(raw);
    run(
      () => setGoal(s.id, g),
      Number.isFinite(g) ? () => patchStaff({ id: s.id, patch: { goal: g } }) : undefined,
    );
  };
  const promptWeight = (s: StaffRow) => {
    const raw = window.prompt(`Lead intake weight for ${s.name} (0–3):`, String(s.intakeWeight));
    if (raw === null) return;
    const w = Number(raw);
    run(
      () => setIntakeWeight(s.id, w),
      Number.isFinite(w) ? () => patchStaff({ id: s.id, patch: { intakeWeight: w } }) : undefined,
    );
  };
  const promptPin = (s: StaffRow) => {
    const raw = window.prompt(`New PIN for ${s.name} (4–6 digits):`);
    if (raw === null) return;
    run(() => setPin(s.id, raw.trim()));
  };

  const submitAdd = (formData: FormData) => {
    run(() => addStaff(String(formData.get("name")), formData.get("role") === "manager" ? "manager" : "rep"));
  };

  // Optimistic on-shift state: a toggle updates the UI (and the live target/
  // headcount) instantly, before the server round-trip, then reconciles on
  // refresh. Server truth matches the optimistic value, so there's no flicker.
  const [optimisticShifts, applyShift] = useOptimistic(
    shifts,
    (cur, u: { staffId: string; val: boolean | null }) =>
      cur.map((s) => {
        if (s.staffId !== u.staffId) return s;
        if (u.val === null) return { ...s, overridden: false, onShift: s.fromSheet };
        return { ...s, overridden: true, onShift: u.val };
      }),
  );

  const toggleShift = (s: ShiftRow, val: boolean | null) => {
    setMessage(null);
    startTransition(async () => {
      applyShift({ staffId: s.staffId, val });
      const r = await setOnShift(s.staffId, val);
      if (r.error) setMessage(r.error);
    });
  };

  const onShiftReps = optimisticShifts.filter((s) => s.onShift);
  const shiftActive = onShiftReps.length;
  const shiftTarget = onShiftReps.reduce((sum, s) => sum + (s.goal ?? 0), 0);

  return (
    <div>
      <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">Managers only</p>
      <h1 className="mt-1 text-4xl font-bold tracking-tight text-brand-900">Manage</h1>

      {message && (
        <p role="alert" className="fade-in mt-4 rounded-xl border border-accent-500 bg-accent-50 px-3 py-2 text-sm font-semibold text-brand-900">
          {message}
        </p>
      )}

      {/* On shift today — drives the live daily team target on /live */}
      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-brand-900">On shift today</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Who&apos;s clocked in drives the live daily target. <b>Auto</b> follows the sheet; set{" "}
              <b>On</b>/<b>Off</b> to override. Resets each day.
            </p>
          </div>
          <p className="text-sm font-semibold text-brand-900">
            <span className="text-2xl font-bold tabular-nums">{shiftTarget}</span> target ·{" "}
            <span className="tabular-nums">{shiftActive}</span> on shift
          </p>
        </div>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {optimisticShifts.map((s) => (
            <li
              key={s.staffId}
              className={cx(
                "flex items-center justify-between gap-2 rounded-xl border px-3 py-2 transition-colors",
                s.onShift ? "border-brand-300 bg-brand-50" : "border-slate-200 bg-slate-50",
              )}
            >
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-brand-950">
                {s.name}
                <span className="ml-1 text-xs font-normal text-slate-400">· goal {s.goal ?? "—"}</span>
                {s.overridden && (
                  <span className="ml-1 rounded bg-accent-100 px-1 text-[0.6rem] font-bold tracking-wide text-brand-900 uppercase">
                    manual
                  </span>
                )}
              </span>
              {/* Not gated on `pending` — these stay clickable so a tap always
                  registers; the optimistic state gives instant feedback. */}
              <div className="flex shrink-0 overflow-hidden rounded-full border border-slate-200">
                {([
                  { label: "Auto", val: null as boolean | null, on: !s.overridden },
                  { label: "On", val: true as boolean | null, on: s.overridden && s.onShift },
                  { label: "Off", val: false as boolean | null, on: s.overridden && !s.onShift },
                ]).map((opt) => (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => toggleShift(s, opt.val)}
                    className={cx(
                      "min-h-8 px-2.5 text-xs font-semibold transition-colors",
                      opt.on
                        ? opt.label === "Off"
                          ? "bg-slate-600 text-white"
                          : "bg-brand-900 text-white"
                        : "bg-white text-slate-500 hover:bg-slate-100",
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </li>
          ))}
          {optimisticShifts.length === 0 && (
            <li className="text-sm text-slate-500">No active reps.</li>
          )}
        </ul>
      </section>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            const raw = window.prompt("Team monthly booking goal:", String(monthlyGoal));
            if (raw !== null) run(() => setMonthlyGoal(Number(raw)));
          }}
          className={cx(btn, "shadow-sm")}
        >
          Monthly goal: {monthlyGoal.toLocaleString()} ✎
        </button>
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
              <th className="px-3 py-2">Weight</th>
              <th className="px-3 py-2">Cell</th>
              <th className="px-3 py-2">Team</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {optimisticStaff.map((s) => (
              <tr key={s.id} className={cx("border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50", !s.active && "opacity-50")}>
                <th scope="row" className="px-3 py-2 text-left font-bold">{s.name}</th>
                <td className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase">{s.role}</td>
                <td className="px-3 py-2 text-xs text-slate-600">
                  {!s.active ? "inactive" : s.locked ? <span className="rounded-full bg-accent-100 px-2 py-0.5 font-bold text-brand-900">LOCKED</span> : "active"}
                </td>
                <td className="px-3 py-2">
                  <button type="button" onClick={() => promptGoal(s)} className={btn}>
                    {s.goal ?? "—"} ✎
                  </button>
                </td>
                <td className="px-3 py-2">
                  <button type="button" onClick={() => promptWeight(s)} className={btn}>
                    {s.intakeWeight.toFixed(1)} ✎
                  </button>
                </td>
                <td className="px-3 py-2">
                  <label className="sr-only" htmlFor={`gender-${s.id}`}>{s.name} cell colour</label>
                  <select
                    id={`gender-${s.id}`}
                    value={s.gender}
                    onChange={(e) => {
                      const gender = e.target.value as "f" | "m" | "x";
                      run(() => setGender(s.id, gender), () => patchStaff({ id: s.id, patch: { gender } }));
                    }}
                    className="min-h-9 rounded-full border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700"
                  >
                    <option value="f">Pink ♀</option>
                    <option value="m">Blue ♂</option>
                    <option value="x">Neutral</option>
                  </select>
                </td>
                <td className="px-3 py-2">
                  <label className="sr-only" htmlFor={`team-${s.id}`}>{s.name} game-day team</label>
                  <select
                    id={`team-${s.id}`}
                    value={s.team ?? ""}
                    onChange={(e) => {
                      const team = (e.target.value || null) as "orange" | "blue" | null;
                      run(() => setTeam(s.id, team), () => patchStaff({ id: s.id, patch: { team } }));
                    }}
                    className="min-h-9 rounded-full border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700"
                  >
                    <option value="">—</option>
                    <option value="orange">🟠 Orange</option>
                    <option value="blue">🔵 Blue</option>
                  </select>
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    <button type="button" onClick={() => promptPin(s)} className={btn}>Reset PIN</button>
                    {s.locked && (
                      <button
                        type="button"
                        onClick={() => run(() => unlockStaff(s.id), () => patchStaff({ id: s.id, patch: { locked: false } }))}
                        className={btn}
                      >
                        Unlock
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => run(() => setActive(s.id, !s.active), () => patchStaff({ id: s.id, patch: { active: !s.active } }))}
                      className={btn}
                    >
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
        <button type="submit" className="min-h-11 rounded-full bg-brand-900 px-5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-brand-800 motion-safe:hover:-translate-y-0.5">
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
