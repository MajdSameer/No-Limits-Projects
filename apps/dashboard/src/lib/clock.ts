/**
 * Pure clock state machine over a day's ordered events. Mirrors the sheet's
 * working-hours column: worked = on-intervals, breaks excluded, live against
 * `now` while still clocked on. Pure + deterministic = exhaustively testable.
 */

export type ClockKind = "in" | "break_start" | "break_end" | "out";

export interface ClockEventLike {
  kind: ClockKind;
  at: Date;
}

export type ClockStatus = "off" | "on" | "break" | "done";

export interface ClockState {
  status: ClockStatus;
  /** When the current status began (null when off). */
  since: Date | null;
  workedMs: number;
  breakMs: number;
}

export function deriveClock(events: ClockEventLike[], now: Date): ClockState {
  let status: ClockStatus = "off";
  let since: Date | null = null;
  let workedMs = 0;
  let breakMs = 0;
  let segmentStart: Date | null = null; // start of current on/break segment

  for (const e of events) {
    switch (e.kind) {
      case "in":
        status = "on";
        since = e.at;
        segmentStart = e.at;
        break;
      case "break_start":
        if (segmentStart) workedMs += e.at.getTime() - segmentStart.getTime();
        status = "break";
        since = e.at;
        segmentStart = e.at;
        break;
      case "break_end":
        if (segmentStart) breakMs += e.at.getTime() - segmentStart.getTime();
        status = "on";
        since = e.at;
        segmentStart = e.at;
        break;
      case "out":
        if (segmentStart) {
          const span = e.at.getTime() - segmentStart.getTime();
          if (status === "on") workedMs += span;
          if (status === "break") breakMs += span;
        }
        status = "done";
        since = e.at;
        segmentStart = null;
        break;
    }
  }

  // Live accumulation for the open segment.
  if (segmentStart) {
    const span = Math.max(0, now.getTime() - segmentStart.getTime());
    if (status === "on") workedMs += span;
    if (status === "break") breakMs += span;
  }

  return { status, since, workedMs, breakMs };
}

export function nextActions(events: ClockEventLike[]): ClockKind[] {
  const last = events[events.length - 1]?.kind;
  if (!last) return ["in"];
  switch (last) {
    case "in":
    case "break_end":
      return ["break_start", "out"];
    case "break_start":
      return ["break_end", "out"];
    case "out":
      return [];
  }
}

export function assertTransition(events: ClockEventLike[], kind: ClockKind): void {
  if (!nextActions(events).includes(kind)) {
    throw new Error(`INVALID_TRANSITION:${kind}`);
  }
}
