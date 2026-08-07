import { describe, expect, it } from "vitest";

import { computeGameDayResult } from "../game-day-results";
import type { BoardRow } from "../boards";

function rep(
  staffId: string,
  name: string,
  count: number,
  team: "orange" | "blue" | null,
): BoardRow {
  return { staffId, name, count, goal: null, gender: "x", team };
}

describe("computeGameDayResult", () => {
  it("sums each team's total and picks the higher one as winner", () => {
    const daily: BoardRow[] = [rep("1", "Ann", 5, "orange"), rep("2", "Luka", 3, "blue")];
    const result = computeGameDayResult(daily);
    expect(result.orangeTotal).toBe(5);
    expect(result.blueTotal).toBe(3);
    expect(result.winner).toBe("orange");
  });

  it("is a tie (null winner) when totals are equal", () => {
    const daily: BoardRow[] = [rep("1", "Ann", 4, "orange"), rep("2", "Luka", 4, "blue")];
    expect(computeGameDayResult(daily).winner).toBeNull();
  });

  it("drops reps with no team assignment", () => {
    const daily: BoardRow[] = [rep("1", "Ann", 5, "orange"), rep("2", "Unassigned", 100, null)];
    const result = computeGameDayResult(daily);
    expect(result.reps.map((r) => r.staffId)).toEqual(["1"]);
    expect(result.blueTotal).toBe(0);
  });

  it("picks the single top scorer", () => {
    const daily: BoardRow[] = [rep("1", "Ann", 5, "orange"), rep("2", "Luka", 3, "blue")];
    expect(computeGameDayResult(daily).topScorerIds).toEqual(["1"]);
  });

  it("shares the top-scorer crown on a tie", () => {
    const daily: BoardRow[] = [rep("1", "Ann", 5, "orange"), rep("2", "Luka", 5, "blue")];
    expect(computeGameDayResult(daily).topScorerIds.sort()).toEqual(["1", "2"]);
  });

  it("no top scorer when everyone is at zero", () => {
    const daily: BoardRow[] = [rep("1", "Ann", 0, "orange"), rep("2", "Luka", 0, "blue")];
    expect(computeGameDayResult(daily).topScorerIds).toEqual([]);
  });
});
