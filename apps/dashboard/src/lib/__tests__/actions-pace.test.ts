import { describe, expect, it } from "vitest";

import { pace, workdayFraction } from "../actions-pace";

describe("workdayFraction", () => {
  it("is 0 at the start of the workday (8am) and 1 at the end (6pm)", () => {
    expect(workdayFraction(8)).toBe(0);
    expect(workdayFraction(18)).toBe(1);
  });

  it("is 0.5 at the midpoint (1pm)", () => {
    expect(workdayFraction(13)).toBe(0.5);
  });

  it("clamps to 0 before 8am and 1 after 6pm", () => {
    expect(workdayFraction(5)).toBe(0);
    expect(workdayFraction(22)).toBe(1);
  });
});

describe("pace", () => {
  it("is ahead when the total meets or beats the expected-by-now figure", () => {
    // mtdDailyAvg 100, half the workday elapsed -> expected 50
    expect(pace(50, 100, 13)).toBe("ahead");
    expect(pace(75, 100, 13)).toBe("ahead");
  });

  it("is behind when the total falls short of expected-by-now", () => {
    expect(pace(40, 100, 13)).toBe("behind");
  });

  it("is ahead at the very start of the day regardless of total (expected is 0)", () => {
    expect(pace(0, 100, 8)).toBe("ahead");
  });
});
