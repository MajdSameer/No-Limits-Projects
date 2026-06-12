"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

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
  off: { label: "Off", cls: "border-brand-700 text-brand-800" },
  on: { label: "On", cls: "border-accent-400 bg-accent-400 text-ink-950" },
  break: { label: "Break", cls: "border-brand-700 text-brand-900" },
  done: { label: "Done", cls: "border-brand-700 text-brand-800" },
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
  useLiveRefresh(["clock", "roster"], () => router.refresh(), 5000);

  const shiftFor = (staffId: string, weekday: number) =>
    shifts.find((s) => s.staffId === staffId && s.weekday === weekday);

  const saveShift = (formData: FormData) => {
    if (!editing) return;
    const start = String(formData.get("start"));
    const end = String(formData.get("end"));
    startTransition(async () => {
      await setShift(editing.staffId, editing.weekday, start, end);
      setEditing(null);
      router.refresh();
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
      router.refresh();
    });
  };

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs font-bold tracking-[0.3em] text-accent-400 uppercase">
            This week
          </p>
          <h1 className="font-display mt-1 text-4xl font-bold tracking-wide text-manila-100 uppercase">
            Roster
          </h1>
        </div>
        <div role="tablist" aria-label="Roster view" className="flex gap-1">
          {(["roster", "timesheet"] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={cx(
                "min-h-11 rounded-full border px-4 font-mono text-xs font-bold tracking-widest uppercase",
                tab === t
                  ? "border-accent-400 bg-accent-400 text-ink-950"
                  : "border-brand-800 text-manila-200 hover:border-accent-400",
              )}
            >
              {t === "roster" ? "Week grid" : "Timesheet"}
            </button>
          ))}
        </div>
      </div>

      {tab === "roster" ? (
        <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_280px]">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse bg-manila-100 text-sm text-brand-950">
              <thead>
                <tr className="border-b-2 border-brand-950 text-left font-mono text-[0.6rem] tracking-[0.2em] text-brand-700 uppercase">
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
                  <tr key={s.id} className="border-b border-manila-400">
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
                              <input id={`start-${s.id}-${weekday}`} name="start" type="time" defaultValue={shift?.start ?? "08:00"} className="border border-manila-400 bg-white px-1 py-0.5" />
                              <label className="sr-only" htmlFor={`end-${s.id}-${weekday}`}>End</label>
                              <input id={`end-${s.id}-${weekday}`} name="end" type="time" defaultValue={shift?.end ?? "17:00"} className="border border-manila-400 bg-white px-1 py-0.5" />
                              <div className="flex gap-1">
                                <button type="submit" disabled={pending} className="bg-brand-900 px-2 py-1 font-bold text-white">OK</button>
                                {shift && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      startTransition(async () => {
                                        await clearShift(s.id, weekday);
                                        setEditing(null);
                                        router.refresh();
                                      })
                                    }
                                    className="border border-brand-900 px-2 py-1"
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
                                "min-h-9 w-full px-2 py-1 text-left hover:bg-manila-200",
                                shift ? "font-bold" : "text-brand-700/50",
                              )}
                            >
                              {shift ? `${shift.start}–${shift.end}` : "—"}
                            </button>
                          ) : (
                            <span className={cx("block px-2 py-1", shift ? "font-bold" : "text-brand-700/50")}>
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
            <h2 className="font-mono text-[0.65rem] font-bold tracking-[0.3em] text-brand-300 uppercase">
              Time off
            </h2>
            <ul className="mt-3 space-y-2">
              {timeOff.length === 0 && <li className="text-sm text-brand-300">Nothing booked.</li>}
              {timeOff.map((t) => (
                <li key={t.id} className="flex items-start justify-between gap-2 border border-brand-800 bg-ink-900 px-3 py-2 text-sm">
                  <span>
                    <span className="font-bold text-manila-100">
                      {staff.find((s) => s.id === t.staffId)?.name ?? t.staffId}
                    </span>
                    <span className="block font-mono text-xs text-brand-300">
                      {t.fromDate} → {t.toDate}
                      {t.reason ? ` · ${t.reason}` : ""}
                    </span>
                  </span>
                  {isManager && (
                    <button
                      type="button"
                      aria-label="Remove time off"
                      onClick={() => startTransition(async () => { await removeTimeOff(t.id); router.refresh(); })}
                      className="grid size-9 place-items-center text-brand-300 hover:text-accent-300"
                    >
                      ✕
                    </button>
                  )}
                </li>
              ))}
            </ul>

            {isManager && (
              <form action={submitTimeOff} className="mt-4 space-y-2 border border-brand-800 bg-ink-900 p-3">
                <p className="font-mono text-[0.6rem] font-bold tracking-[0.25em] text-brand-300 uppercase">Add time off</p>
                <label className="sr-only" htmlFor="to-staff">Staff</label>
                <select id="to-staff" name="staffId" className="min-h-10 w-full border border-brand-800 bg-ink-950 px-2 text-manila-100">
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <label className="sr-only" htmlFor="to-from">From</label>
                  <input id="to-from" name="fromDate" type="date" required className="min-h-10 w-full border border-brand-800 bg-ink-950 px-2 text-manila-100" />
                  <label className="sr-only" htmlFor="to-to">To</label>
                  <input id="to-to" name="toDate" type="date" required className="min-h-10 w-full border border-brand-800 bg-ink-950 px-2 text-manila-100" />
                </div>
                <label className="sr-only" htmlFor="to-reason">Reason</label>
                <input id="to-reason" name="reason" placeholder="Reason (optional)" className="min-h-10 w-full border border-brand-800 bg-ink-950 px-2 text-manila-100 placeholder:text-brand-700" />
                <button type="submit" disabled={pending} className="min-h-10 w-full bg-accent-400 font-mono text-xs font-bold tracking-widest text-ink-950 uppercase hover:bg-accent-300">
                  Add
                </button>
              </form>
            )}
          </aside>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full max-w-3xl border-collapse bg-manila-100 text-sm text-brand-950">
            <thead>
              <tr className="border-b-2 border-brand-950 text-left font-mono text-[0.6rem] tracking-[0.2em] text-brand-700 uppercase">
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
                    <span className={cx("border px-2 py-0.5 font-mono text-[0.6rem] font-bold tracking-widest uppercase", STATUS_BADGE[r.status].cls)}>
                      {STATUS_BADGE[r.status].label}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono">{r.status === "off" ? "—" : hours(r.workedMs)}</td>
                  <td className="px-3 py-2 font-mono">{r.breakMs > 0 ? hours(r.breakMs) : "—"}</td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {r.lateMins !== null && <span className="mr-2 border border-brand-900 px-1.5 py-0.5">late {r.lateMins}m</span>}
                    {r.autoClosed && <span className="border border-brand-900 px-1.5 py-0.5">auto-closed</span>}
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
