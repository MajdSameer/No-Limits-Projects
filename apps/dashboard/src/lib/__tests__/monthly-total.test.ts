import { expect, test } from "vitest";

import { pickMonthlyTotal } from "../monthly-total";

test("uses the sheet's own total when it's plausible (can differ slightly from the board sum)", () => {
  expect(pickMonthlyTotal(1196, 1210)).toBe(1196);
  expect(pickMonthlyTotal(1250, 1210)).toBe(1250);
});

test("falls back to the board sum when the sheet hasn't pushed a total", () => {
  expect(pickMonthlyTotal(null, 1210)).toBe(1210);
});

test("a zero sheet total (broken #N/A import) is ignored, not shown as 0", () => {
  expect(pickMonthlyTotal(0, 1210)).toBe(1210);
});

test("a collapsed sheet total (< half the board sum) is ignored", () => {
  expect(pickMonthlyTotal(40, 1210)).toBe(1210);
});

test("1st of the month: both zero is a legitimate 0", () => {
  expect(pickMonthlyTotal(0, 0)).toBe(0);
  expect(pickMonthlyTotal(null, 0)).toBe(0);
});
