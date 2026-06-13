import { describe, expect, test } from "vitest";

import { cellMessage, cellTier, greeting } from "../leaderboard-messages";
import { allocate, type AllocCandidate } from "../lead-allocation";

describe("cellTier", () => {
  test("classifies the full ladder", () => {
    expect(cellTier(0, 7)).toBe("zero");
    expect(cellTier(3, 7)).toBe("progress");
    expect(cellTier(6, 7)).toBe("almost"); // goal-1
    expect(cellTier(7, 7)).toBe("hit");
    expect(cellTier(9, 7)).toBe("over"); // +2
    expect(cellTier(11, 7)).toBe("wild"); // +4 → cheeky
    expect(cellTier(14, 7)).toBe("wild"); // 2× → cheeky
  });
  test("no goal still rewards activity", () => {
    expect(cellTier(0, null)).toBe("zero");
    expect(cellTier(3, null)).toBe("progress");
  });
});

describe("cellMessage / greeting", () => {
  test("stable per rep+day+tier, valid pick", () => {
    const a = cellMessage("andy", "2026-06-13", "wild");
    const b = cellMessage("andy", "2026-06-13", "wild");
    expect(a).toBe(b);
    expect(a.length).toBeGreaterThan(0);
  });
  test("wild tier yields a cheeky line", () => {
    const lines = new Set(
      ["andy", "hanna", "max", "ann", "harry"].map((id) => cellMessage(id, "2026-06-13", "wild")),
    );
    expect([...lines].some((l) => /slow down|leave some|show-off|fair/i.test(l))).toBe(true);
  });
  test("greeting names the rep", () => {
    expect(greeting("Max", "2026-06-13")).toContain("Max");
  });
});

describe("allocate", () => {
  const c = (
    staffId: string,
    weight: number,
    status: AllocCandidate["status"],
    leadsToday = 0,
  ): AllocCandidate => ({ staffId, name: staffId, weight, status, leadsToday });

  test("only clocked-in, not-on-break reps are eligible", () => {
    const a = allocate([
      c("andy", 1.1, "on"),
      c("ann", 0.9, "break"), // excluded — on break
      c("max", 1.1, "off"), // excluded — not clocked in
      c("hanna", 0.7, "done"), // excluded — finished
    ]);
    expect(a.eligible.map((e) => e.staffId)).toEqual(["andy"]);
    expect(a.nextUp).toBe("andy");
  });

  test("shares are weight-proportional among eligible", () => {
    const a = allocate([c("andy", 1.0, "on"), c("ann", 3.0, "on")]);
    const andy = a.eligible.find((e) => e.staffId === "andy")!;
    const ann = a.eligible.find((e) => e.staffId === "ann")!;
    expect(Math.round(andy.sharePct)).toBe(25);
    expect(Math.round(ann.sharePct)).toBe(75);
  });

  test("next-up is whoever is most behind their fair share", () => {
    // Equal weights, andy already took 2 today, ann 0 → ann is owed the next.
    const a = allocate([c("andy", 1.0, "on", 2), c("ann", 1.0, "on", 0)]);
    expect(a.nextUp).toBe("ann");
    expect(a.totalLeadsToday).toBe(2);
  });

  test("nobody eligible → nextUp null", () => {
    expect(allocate([c("andy", 1.1, "break")]).nextUp).toBeNull();
  });
});
