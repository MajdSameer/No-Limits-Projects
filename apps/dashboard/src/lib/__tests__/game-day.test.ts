import { describe, expect, it } from "vitest";

import {
  buildFacts,
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
  wallScore,
  wallTeamOf,
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

describe("wallTeamOf", () => {
  it("keeps stored teams and maps everyone else to the third (cyan) team", () => {
    expect(wallTeamOf("orange")).toBe("orange");
    expect(wallTeamOf("blue")).toBe("blue");
    expect(wallTeamOf(null)).toBe("cyan");
  });
});

describe("wallScore", () => {
  it("is exactly the two-team scoreboard when nobody is unassigned", () => {
    const s = wallScore([rep("1", "Ann", 5, "orange"), rep("2", "Luka", 3, "blue")]);
    expect(s.hasThird).toBe(false);
    expect(s.teams).toEqual(["orange", "blue"]);
    expect(s.totals).toMatchObject({ orange: 5, blue: 3, cyan: 0 });
    expect(s.total).toBe(8);
    expect(s.leader).toBe("orange");
    expect(s.margin).toBe(2);
    expect(s.tied).toEqual([]);
  });

  it("makes the unassigned reps the third team and counts them everywhere", () => {
    const s = wallScore([
      rep("1", "Ann", 2, "orange"),
      rep("2", "Luka", 3, "blue"),
      rep("3", "Una", 6, null),
      rep("4", "Uri", 1, null),
    ]);
    expect(s.hasThird).toBe(true);
    expect(s.teams).toEqual(["orange", "blue", "cyan"]);
    expect(s.groups.cyan.map((r) => r.staffId)).toEqual(["3", "4"]);
    expect(s.totals).toMatchObject({ orange: 2, blue: 3, cyan: 7 });
    expect(s.total).toBe(12);
    expect(s.leader).toBe("cyan");
    expect(s.margin).toBe(4); // 7 over the runner-up on 3
    expect([...s.topIds]).toEqual(["3"]); // top scorer is picked floor-wide, third team included
  });

  it("margin is leader minus the RUNNER-UP, not the last-place team", () => {
    const s = wallScore([rep("1", "A", 9, "orange"), rep("2", "B", 8, "blue"), rep("3", "C", 0, null)]);
    expect(s.leader).toBe("orange");
    expect(s.margin).toBe(1);
  });

  it("flags who is tied for first, even when the third team trails", () => {
    const s = wallScore([rep("1", "A", 4, "orange"), rep("2", "B", 4, "blue"), rep("3", "C", 1, null)]);
    expect(s.leader).toBeNull();
    expect(s.tied).toEqual(["orange", "blue"]);
    expect(s.margin).toBe(0);
  });

  it("a three-way tie and 0–0 have no leader", () => {
    const three = wallScore([rep("1", "A", 2, "orange"), rep("2", "B", 2, "blue"), rep("3", "C", 2, null)]);
    expect(three.leader).toBeNull();
    expect(three.tied).toHaveLength(3);
    const zero = wallScore([rep("1", "A", 0, "orange"), rep("2", "B", 0, "blue"), rep("3", "C", 0, null)]);
    expect(zero.leader).toBeNull();
    expect(zero.tied).toEqual([]);
    expect(zero.total).toBe(0);
  });
});

describe("leadLine with three teams", () => {
  const L3 = { orange: "Green", blue: "Purple", cyan: "Cyan" } as const;

  it("says GAME TIED only when every team is level", () => {
    const all = wallScore([rep("1", "A", 2, "orange"), rep("2", "B", 2, "blue"), rep("3", "C", 2, null)]);
    expect(leadLine({ ...all, teamCount: all.teams.length }, L3).text).toBe("⚡ GAME TIED");
  });

  it("names the teams tied for first when the third trails", () => {
    const s = wallScore([rep("1", "A", 4, "orange"), rep("2", "B", 4, "blue"), rep("3", "C", 1, null)]);
    expect(leadLine({ ...s, teamCount: s.teams.length }, L3).text).toBe("⚡ GREEN & PURPLE TIED");
  });

  it("names the third team as leader", () => {
    expect(leadLine({ leader: "cyan", margin: 2, total: 9 }, L3).text).toBe("CYAN LEADS BY 2 BOOKINGS");
    expect(takesLeadLine("cyan", L3)).toBe("CYAN TAKES THE LEAD!");
  });
});

describe("buildRoster with a third team", () => {
  it("introduces the unassigned reps too, as cyan, only when asked", () => {
    const monthly = [{ ...rep("a", "Ann", 40, "orange") }, { ...rep("u", "Una", 5, null) }];
    const daily = [rep("a", "Ann", 1, "orange"), rep("u", "Una", 0, null), rep("v", "Vic", 0, null)];
    expect(buildRoster(daily, monthly).map((r) => r.staffId)).toEqual(["a"]);
    const withThird = buildRoster(daily, monthly, true);
    expect(withThird.map((r) => [r.staffId, r.team])).toEqual([
      ["v", "cyan"],
      ["u", "cyan"],
      ["a", "orange"],
    ]);
  });
});

describe("buildFacts", () => {
  const LABELS3 = { orange: "Green", blue: "Purple", cyan: "Cyan" };

  it("two teams: unassigned reps are ignored and the wording is unchanged", () => {
    const facts = buildFacts([rep("1", "Ann", 5, "orange"), rep("2", "Luka", 1, "blue"), rep("3", "Una", 50, null)], LABELS3, 50);
    expect(facts.join("\n")).toContain("Green are pulling away — up by 4. Purple, time to respond!");
    expect(facts.join("\n")).not.toContain("Una");
  });

  it("three teams: the unassigned reps are in play and the runner-up is who 'responds'", () => {
    const facts = buildFacts(
      [rep("1", "Ann", 1, "orange"), rep("2", "Luka", 3, "blue"), rep("3", "Una", 9, null), rep("4", "Uri", 1, null)],
      LABELS3,
      50,
      true,
    );
    const text = facts.join("\n");
    expect(text).toContain("Una is leading the whole floor with 9 today");
    expect(text).toContain("Cyan are pulling away — up by 7. Purple, time to respond!");
  });
});
