import { describe, expect, it } from "vitest";

import {
  buildRoster,
  countdownPhase,
  countIncreases,
  formatCountdown,
  leadLine,
  milestoneCrossed,
  pushTier,
  rankRows,
  scoreState,
  secsUntilGameEnd,
  takesLeadLine,
} from "../game-day";

const LABELS = { orange: "Green", blue: "Purple" } as const;

function rep(staffId: string, name: string, count: number, team: "orange" | "blue" | null) {
  return { staffId, name, count, team };
}

describe("scoreState (mirrors computeGameDayResult)", () => {
  it("sums each team's total and picks the higher one as leader", () => {
    const s = scoreState([rep("1", "Ann", 5, "orange"), rep("2", "Luka", 3, "blue")]);
    expect(s.orangeTotal).toBe(5);
    expect(s.blueTotal).toBe(3);
    expect(s.total).toBe(8);
    expect(s.margin).toBe(2);
    expect(s.leader).toBe("orange");
  });

  it("is a tie (null leader) when totals are equal, including 0–0", () => {
    expect(scoreState([rep("1", "Ann", 4, "orange"), rep("2", "Luka", 4, "blue")]).leader).toBeNull();
    expect(scoreState([rep("1", "Ann", 0, "orange"), rep("2", "Luka", 0, "blue")]).leader).toBeNull();
  });

  it("drops reps with no team assignment", () => {
    const s = scoreState([rep("1", "Ann", 5, "orange"), rep("2", "Unassigned", 100, null)]);
    expect(s.teamed.map((r) => r.staffId)).toEqual(["1"]);
    expect(s.blueTotal).toBe(0);
  });

  it("picks the single top scorer", () => {
    const s = scoreState([rep("1", "Ann", 5, "orange"), rep("2", "Luka", 3, "blue")]);
    expect([...s.topIds]).toEqual(["1"]);
  });

  it("shares the top-scorer crown on a tie", () => {
    const s = scoreState([rep("1", "Ann", 5, "orange"), rep("2", "Luka", 5, "blue")]);
    expect([...s.topIds].sort()).toEqual(["1", "2"]);
  });

  it("has no top scorer when everyone is at zero", () => {
    const s = scoreState([rep("1", "Ann", 0, "orange"), rep("2", "Luka", 0, "blue")]);
    expect(s.topIds.size).toBe(0);
  });
});

describe("rankRows", () => {
  it("sorts by bookings desc, then name A→Z for ties (stable between polls)", () => {
    const rows = [rep("a", "Zed", 2, "orange"), rep("b", "Ann", 4, "orange"), rep("c", "Bob", 2, "orange")];
    expect(rankRows(rows).map((r) => r.name)).toEqual(["Ann", "Bob", "Zed"]);
  });

  it("does not mutate the input", () => {
    const rows = [rep("a", "Zed", 1, "orange"), rep("b", "Ann", 3, "orange")];
    rankRows(rows);
    expect(rows.map((r) => r.name)).toEqual(["Zed", "Ann"]);
  });
});

describe("leadLine", () => {
  it("prompts for the first booking at 0–0", () => {
    expect(leadLine({ leader: null, margin: 0, total: 0 }, LABELS)).toMatchObject({
      kind: "empty",
      text: "FIRST BOOKING TAKES THE LEAD",
    });
  });

  it("shows a tie once there are bookings", () => {
    expect(leadLine({ leader: null, margin: 0, total: 6 }, LABELS)).toMatchObject({
      kind: "tied",
      text: "⚡ GAME TIED",
    });
  });

  it("pluralises bookings correctly", () => {
    expect(leadLine({ leader: "orange", margin: 1, total: 3 }, LABELS).text).toBe("GREEN LEADS BY 1 BOOKING");
    expect(leadLine({ leader: "blue", margin: 3, total: 9 }, LABELS).text).toBe("PURPLE LEADS BY 3 BOOKINGS");
  });

  it("takesLeadLine names the new leader", () => {
    expect(takesLeadLine("blue", LABELS)).toBe("PURPLE TAKES THE LEAD!");
  });
});

describe("milestoneCrossed", () => {
  it("returns the milestone crossed by a +1", () => {
    expect(milestoneCrossed(4, 5)).toBe(5);
    expect(milestoneCrossed(9, 10)).toBe(10);
  });

  it("returns null when no milestone is crossed", () => {
    expect(milestoneCrossed(5, 6)).toBeNull();
    expect(milestoneCrossed(0, 0)).toBeNull();
  });

  it("returns the highest milestone when a jump crosses several", () => {
    expect(milestoneCrossed(3, 12)).toBe(10);
  });

  it("does not re-fire when already past the milestone", () => {
    expect(milestoneCrossed(10, 11)).toBeNull();
  });
});

describe("countIncreases", () => {
  it("is silent on the first (seed) pass", () => {
    expect(countIncreases(null, [rep("a", "Ann", 4, "orange")])).toEqual([]);
  });

  it("reports only reps whose count went up", () => {
    const prev = new Map([
      ["a", 2],
      ["b", 3],
      ["c", 1],
    ]);
    const rows = [rep("a", "Ann", 3, "orange"), rep("b", "Bob", 3, "blue"), rep("c", "Cat", 0, "blue")];
    expect(countIncreases(prev, rows)).toEqual([{ staffId: "a", from: 2, to: 3 }]);
  });

  it("ignores reps that were not in the previous poll", () => {
    const prev = new Map([["a", 2]]);
    expect(countIncreases(prev, [rep("a", "Ann", 2, "orange"), rep("z", "New", 5, "blue")])).toEqual([]);
  });
});

describe("countdown", () => {
  it("counts down to 7 PM Sydney time", () => {
    // 08:03:15 AEST (UTC+10, no DST in early September).
    const now = new Date("2026-09-04T08:03:15+10:00");
    expect(secsUntilGameEnd(now)).toBe(19 * 3600 - (8 * 3600 + 3 * 60 + 15));
  });

  it("goes negative after the whistle", () => {
    expect(secsUntilGameEnd(new Date("2026-09-04T19:00:01+10:00"))).toBe(-1);
  });

  it("formats as H:MM:SS and clamps at zero", () => {
    expect(formatCountdown(10 * 3600 + 56 * 60 + 45)).toBe("10:56:45");
    expect(formatCountdown(59)).toBe("0:00:59");
    expect(formatCountdown(-5)).toBe("0:00:00");
  });

  it("phases: normal → final hour → final 10 minutes → over", () => {
    expect(countdownPhase(2 * 3600)).toBe("normal");
    expect(countdownPhase(3600)).toBe("finalHour");
    expect(countdownPhase(601)).toBe("finalHour");
    expect(countdownPhase(600)).toBe("final10");
    expect(countdownPhase(1)).toBe("final10");
    expect(countdownPhase(0)).toBe("over");
  });

  it("pushTier picks the most urgent tier inside the window", () => {
    expect(pushTier(3600)).toBeNull();
    expect(pushTier(1800)?.at).toBe(1800);
    expect(pushTier(299)?.at).toBe(300);
    expect(pushTier(30)?.at).toBe(60);
  });
});

describe("buildRoster", () => {
  it("uses the monthly board for counts/revenue, fills gaps from daily, underdogs first", () => {
    const monthly = [
      { ...rep("a", "Ann", 40, "orange"), revenue: 90000 },
      { ...rep("b", "Bob", 12, "blue"), revenue: 1000 },
      { ...rep("x", "NoTeam", 99, null) },
    ];
    const daily = [rep("c", "Cat", 1, "blue"), rep("a", "Ann", 2, "orange")];
    const roster = buildRoster(daily, monthly);
    expect(roster.map((r) => r.staffId)).toEqual(["c", "b", "a"]);
    expect(roster[2]).toMatchObject({ month: 40, revenue: 90000 });
    expect(roster[0]).toMatchObject({ month: 0, revenue: null });
  });
});
