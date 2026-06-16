import { describe, expect, test } from "vitest";

import {
  next3MonthsDateRange,
  sydneyDayRange,
  sydneyMonthRange,
  sydneyToday,
  sydneyYesterdayRange,
} from "../sydney";

describe("sydneyDayRange", () => {
  test("AEST day maps to 14:00Z boundaries", () => {
    // 2026-06-12 in Sydney (UTC+10): starts 11th 14:00Z, ends 12th 14:00Z.
    const { start, end } = sydneyDayRange(new Date("2026-06-12T03:00:00Z"));
    expect(start.toISOString()).toBe("2026-06-11T14:00:00.000Z");
    expect(end.toISOString()).toBe("2026-06-12T14:00:00.000Z");
  });

  test("UTC time that is already tomorrow in Sydney buckets to the Sydney day", () => {
    // 2026-06-12T15:30Z = 2026-06-13 01:30 in Sydney.
    const { start } = sydneyDayRange(new Date("2026-06-12T15:30:00Z"));
    expect(start.toISOString()).toBe("2026-06-12T14:00:00.000Z");
  });

  test("DST-end day (first Sunday of April) is 25 hours long", () => {
    const { start, end } = sydneyDayRange(new Date("2026-04-05T01:00:00Z"));
    expect((end.getTime() - start.getTime()) / 36e5).toBe(25);
  });
});

describe("sydneyMonthRange", () => {
  test("June 2026 (AEST)", () => {
    const { start, end } = sydneyMonthRange(new Date("2026-06-12T03:00:00Z"));
    expect(start.toISOString()).toBe("2026-05-31T14:00:00.000Z");
    expect(end.toISOString()).toBe("2026-06-30T14:00:00.000Z");
  });

  test("October 2026 spans the DST start (starts +10, ends +11)", () => {
    const { start, end } = sydneyMonthRange(new Date("2026-10-15T03:00:00Z"));
    expect(start.toISOString()).toBe("2026-09-30T14:00:00.000Z");
    expect(end.toISOString()).toBe("2026-10-31T13:00:00.000Z");
  });
});

describe("date-string helpers", () => {
  test("sydneyToday reflects Sydney calendar, not UTC", () => {
    expect(sydneyToday(new Date("2026-06-12T15:30:00Z"))).toBe("2026-06-13");
    expect(sydneyToday(new Date("2026-06-12T03:00:00Z"))).toBe("2026-06-12");
  });

  test("next3MonthsDateRange is a rolling [today, today+3mo] window", () => {
    expect(next3MonthsDateRange(new Date("2026-06-12T03:00:00Z"))).toEqual({
      from: "2026-06-12",
      to: "2026-09-12",
    });
  });

  test("yesterday range is the prior Sydney day", () => {
    const { start, end } = sydneyYesterdayRange(new Date("2026-06-12T03:00:00Z"));
    expect(start.toISOString()).toBe("2026-06-10T14:00:00.000Z");
    expect(end.toISOString()).toBe("2026-06-11T14:00:00.000Z");
  });
});
