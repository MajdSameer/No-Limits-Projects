import { describe, expect, test } from "vitest";

import { assertTransition, deriveClock, nextActions, type ClockEventLike } from "../clock";

const at = (hhmm: string) => new Date(`2026-06-12T${hhmm}:00+10:00`);
const ev = (kind: ClockEventLike["kind"], hhmm: string): ClockEventLike => ({ kind, at: at(hhmm) });
const H = 36e5;

describe("deriveClock", () => {
  test("fresh day", () => {
    const s = deriveClock([], at("09:00"));
    expect(s.status).toBe("off");
    expect(s.workedMs).toBe(0);
    expect(nextActions([])).toEqual(["in"]);
  });

  test("clocked in accumulates live against now", () => {
    const s = deriveClock([ev("in", "08:00")], at("10:30"));
    expect(s.status).toBe("on");
    expect(s.workedMs).toBe(2.5 * H);
    expect(nextActions([ev("in", "08:00")])).toEqual(["break_start", "out"]);
  });

  test("break pauses work and accumulates break time", () => {
    const evs = [ev("in", "08:00"), ev("break_start", "12:00")];
    const s = deriveClock(evs, at("12:30"));
    expect(s.status).toBe("break");
    expect(s.workedMs).toBe(4 * H);
    expect(s.breakMs).toBe(0.5 * H);
    expect(nextActions(evs)).toEqual(["break_end", "out"]);
  });

  test("full day matches the sheet formula", () => {
    const evs = [
      ev("in", "08:00"),
      ev("break_start", "12:00"),
      ev("break_end", "13:00"),
      ev("out", "17:00"),
    ];
    const s = deriveClock(evs, at("18:00"));
    expect(s.status).toBe("done");
    expect(s.workedMs).toBe(8 * H);
    expect(s.breakMs).toBe(1 * H);
    expect(nextActions(evs)).toEqual([]);
  });

  test("multiple breaks all count", () => {
    const evs = [
      ev("in", "08:00"),
      ev("break_start", "10:00"),
      ev("break_end", "10:15"),
      ev("break_start", "13:00"),
      ev("break_end", "13:45"),
      ev("out", "16:00"),
    ];
    const s = deriveClock(evs, at("17:00"));
    expect(s.workedMs).toBe(7 * H);
    expect(s.breakMs).toBe(1 * H);
  });

  test("clocking out during a break closes the break at out-time", () => {
    const evs = [ev("in", "08:00"), ev("break_start", "12:00"), ev("out", "12:30")];
    const s = deriveClock(evs, at("13:00"));
    expect(s.status).toBe("done");
    expect(s.workedMs).toBe(4 * H);
    expect(s.breakMs).toBe(0.5 * H);
  });
});

describe("transitions", () => {
  test("invalid transitions throw, valid ones don't", () => {
    expect(() => assertTransition([], "out")).toThrow();
    expect(() => assertTransition([], "break_start")).toThrow();
    expect(() => assertTransition([ev("in", "08:00")], "in")).toThrow();
    expect(() => assertTransition([ev("in", "08:00")], "break_end")).toThrow();
    expect(() => assertTransition([ev("in", "08:00")], "break_start")).not.toThrow();
    const done = [ev("in", "08:00"), ev("out", "17:00")];
    expect(nextActions(done)).toEqual([]);
    expect(() => assertTransition(done, "in")).toThrow();
  });
});
