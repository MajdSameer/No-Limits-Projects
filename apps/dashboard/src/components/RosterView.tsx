"use client";

import { useRouter } from "next/navigation";
import { startTransition as lowPriority, useState, useTransition } from "react";

import { cx } from "@nlr/ui";

import { addTimeOff, clearShift, removeTimeOff, setShift } from "../app/actions/roster";
import { useLiveRefresh } from "../lib/live";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface Shift {
  staffId: string;
  weekday: number;
  start: string;
  end: string;
}
interface TimeOffRow {
  id: string;
  staffId: string;
  fromDate: string;
  toDate: string;
  reason: string | null;
}
interface TodayRow {
  staffId: string;
  name: string;
  status: "off" | "on" | "break" | "done";
  workedMs: number;
  breakMs: number;
  autoClosed: boolean;
  lateMins: number | null;
}

const STATUS_BADGE: Record<TodayRow["status"], { label: string; cls: string }> = {
  off: { label: "Off", cls: "bg-slate-100 text-slate-600" },
  on: { label: "On", cls: "bg-accent-400 text-brand-950" },
  break: { label: "Break", cls: "bg-brand-100 text-brand-800" },
  done: { label: "Done", cls: "bg-brand-900 text-white" },
};

function hours(ms: number): string {
  const mins = Math.round(ms / 60000);
  return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, "0")}m`;
}

export function RosterView({
  isManager,
  staff,
  shifts,
  timeOff,
  today,
}: {
  isManager: boolean;
  staff: Array<{ id: string; name: string }>;
  shifts: Shift[];
  timeOff: TimeOffRow[];
  today: TodayRow[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"roster" | "timesheet">("roster");
  const [editing, setEditing] = useState<{ staffId: string; weekday: number } | null>(null);
  const [pending, startTransition] = useTransition();
  // Clock punches / roster edits push a realtime ping (see notify), so live
  // status updates near-instantly. This poll is just a safety net — keep it slow
  // and low-priority so it never re-runs the whole server tree under the user's
  // clicks. (Was every 5s and blocking, which made the page feel janky.)
  useLiveRefresh(["clock", "roster"], () => lowPriority(() => router.refresh()), 20000);

  const shiftFor = (staffId: string, weekday: number) =>
    shifts.find((s) => s.staffId === staffId && s.weekday === weekday);

  const saveShift = (formData: FormData) => {
    if (!editing) return;
    const start = String(formData.get("start"));
    const end = String(formData.get("end"));
    startTransition(async () => {
      await setShift(editing.staffId, editing.weekday, start, end);
      setEditing(null);
      lowPriority(() => router.refresh());
    });
  };

  const submitTimeOff = (formData: FormData) => {
    startTransition(async () => {
      await addTimeOff(
        String(formData.get("staffId")),
        String(formData.get("fromDate")),
        String(formData.get("toDate")),
        String(formData.get("reason") ?? ""),
      );
      lowPriority(() => router.refresh());
    });
  };

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">This week</p>
          <h1 className="mt-1 text-4xl font-bold tracking-tight text-brand-900">Roster</h1>
        </div>
        <div role="tablist" aria-label="Roster view" className="flex gap-1 rounded-full bg-slate-100 p-1">
          {(["roster", "timesheet"] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={cx(
                "min-h-9 rounded-full px-4 text-sm font-semibold transition-all duration-200",
                tab === t ? "bg-white text-brand-900 shadow-sm" : "text-slate-600 hover:text-brand-900",
              )}
            >
              {t === "roster" ? "Week grid" : "Timesheet"}
            </button>
          ))}
        </div>
      </div>

      {tab === "roster" ? (
        <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_280px]">
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full border-collapse text-sm text-brand-950">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold text-slate-500">
                  <th className="px-3 py-2">Team</th>
                  {WEEKDAYS.map((d) => (
                    <th key={d} className="px-3 py-2">
                      {d}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {staff.map((s) => (
                  <tr key={s.id} className="border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50">
                    <th scope="row" className="px-3 py-2 text-left font-bold">
                      {s.name}
                    </th>
                    {WEEKDAYS.map((_, weekday) => {
                      const shift = shiftFor(s.id, weekday);
                      const isEditing = editing?.staffId === s.id && editing.weekday === weekday;
                      return (
                        <td key={weekday} className="px-1 py-1 font-mono text-xs">
                          {isEditing ? (
                            <form action={saveShift} className="flex flex-col gap-1">
                              <label className="sr-only" htmlFor={`start-${s.id}-${weekday}`}>Start</label>
                              <input id={`start-${s.id}-${weekday}`} name="start" type="time" defaultValue={shift?.start ?? "08:00"} className="rounded-lg border border-slate-200 bg-white px-1 py-0.5" />
                              <label className="sr-only" htmlFor={`end-${s.id}-${weekday}`}>End</label>
                              <input id={`end-${s.id}-${weekday}`} name="end" type="time" defaultValue={shift?.end ?? "17:00"} className="rounded-lg border border-slate-200 bg-white px-1 py-0.5" />
                              <div className="flex gap-1">
                                <button type="submit" disabled={pending} className="rounded-lg bg-brand-900 px-2 py-1 font-bold text-white">OK</button>
                                {shift && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      startTransition(async () => {
                                        await clearShift(s.id, weekday);
                                        setEditing(null);
                                        lowPriority(() => router.refresh());
                                      })
                                    }
                                    className="rounded-lg border border-slate-300 px-2 py-1"
                                  >
                                    ✕
                                  </button>
                                )}
                                <button type="button" onClick={() => setEditing(null)} className="px-1">esc</button>
                              </div>
                            </form>
                          ) : isManager ? (
                            <button
                              type="button"
                              onClick={() => setEditing({ staffId: s.id, weekday })}
                              className={cx(
                                "min-h-9 w-full rounded-lg px-2 py-1 text-left transition-colors hover:bg-slate-100",
                                shift ? "font-bold" : "text-slate-500",
                              )}
                            >
                              {shift ? `${shift.start}–${shift.end}` : "—"}
                            </button>
                          ) : (
                            <span className={cx("block px-2 py-1", shift ? "font-bold" : "text-slate-500")}>
                              {shift ? `${shift.start}–${shift.end}` : "—"}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <aside>
            <h2 className="text-sm font-bold text-brand-900">Time off</h2>
            <ul className="mt-3 space-y-2">
              {timeOff.length === 0 && <li className="text-sm text-slate-500">Nothing booked.</li>}
              {timeOff.map((t) => (
                <li key={t.id} className="fade-in flex items-start justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm">
                  <span>
                    <span className="font-bold text-brand-900">
                      {staff.find((s) => s.id === t.staffId)?.name ?? t.staffId}
                    </span>
                    <span className="block text-xs text-slate-500">
                      {t.fromDate} → {t.toDate}
                      {t.reason ? ` · ${t.reason}` : ""}
                    </span>
                  </span>
                  {isManager && (
                    <button
                      type="button"
                      aria-label="Remove time off"
                      onClick={() => startTransition(async () => { await removeTimeOff(t.id); lowPriority(() => router.refresh()); })}
                      className="grid size-9 place-items-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-brand-900"
                    >
                      ✕
                    </button>
                  )}
                </li>
              ))}
            </ul>

            {isManager && (
              <form action={submitTimeOff} className="mt-4 space-y-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold text-slate-500">Add time off</p>
                <label className="sr-only" htmlFor="to-staff">Staff</label>
                <select id="to-staff" name="staffId" className="min-h-10 w-full rounded-xl border border-slate-200 bg-white px-2 text-brand-950 shadow-sm">
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <label className="sr-only" htmlFor="to-from">From</label>
                  <input id="to-from" name="fromDate" type="date" required className="min-h-10 w-full rounded-xl border border-slate-200 bg-white px-2 text-brand-950 shadow-sm" />
                  <label className="sr-only" htmlFor="to-to">To</label>
                  <input id="to-to" name="toDate" type="date" required className="min-h-10 w-full rounded-xl border border-slate-200 bg-white px-2 text-brand-950 shadow-sm" />
                </div>
                <label className="sr-only" htmlFor="to-reason">Reason</label>
                <input id="to-reason" name="reason" placeholder="Reason (optional)" className="min-h-10 w-full rounded-xl border border-slate-200 bg-white px-2 text-brand-950 shadow-sm placeholder:text-slate-400" />
                <button type="submit" disabled={pending} className="min-h-10 w-full rounded-full bg-brand-900 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-800">
                  Add
                </button>
              </form>
            )}
          </aside>
        </div>
      ) : (
        <div className="mt-6 max-w-3xl overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full border-collapse text-sm text-brand-950">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold text-slate-500">
                <th className="px-3 py-2">Rep</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Worked today</th>
                <th className="px-3 py-2">Breaks</th>
                <th className="px-3 py-2">Flags</th>
              </tr>
            </thead>
            <tbody>
              {today.map((r) => (
                <tr key={r.staffId} className="border-b border-manila-400">
                  <th scope="row" className="px-3 py-2 text-left font-bold">{r.name}</th>
                  <td className="px-3 py-2">
                    <span className={cx("rounded-full px-2.5 py-1 text-[0.65rem] font-bold tracking-wide uppercase", STATUS_BADGE[r.status].cls)}>
                      {STATUS_BADGE[r.status].label}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-600">{r.status === "off" ? "—" : hours(r.workedMs)}</td>
                  <td className="px-3 py-2 text-slate-600">{r.breakMs > 0 ? hours(r.breakMs) : "—"}</td>
                  <td className="px-3 py-2 text-xs text-slate-600">
                    {r.lateMins !== null && <span className="mr-2 rounded-full bg-accent-100 px-2 py-0.5 font-semibold text-brand-900">late {r.lateMins}m</span>}
                    {r.autoClosed && <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-600">auto-closed</span>}
                    {r.lateMins === null && !r.autoClosed && "—"}
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
