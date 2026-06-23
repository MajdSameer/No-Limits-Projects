import { expect, test } from "vitest";

import { tierProgress } from "../tiers";

test("below Tier 1 — chasing Tier 1", () => {
  const p = tierProgress(30);
  expect(p.reached).toBe(0);
  expect(p.reachedName).toBeNull();
  expect(p.next?.short).toBe("T1");
  expect(p.gap).toBe(12); // 42 - 30
  expect(p.top).toBe(false);
});

test("mid-pack — reached Tier 2, chasing Tier 3", () => {
  const p = tierProgress(104);
  expect(p.reached).toBe(2);
  expect(p.reachedName).toBe("Tier 2");
  expect(p.next?.short).toBe("T3");
  expect(p.gap).toBe(11); // 115 - 104
});

test("exactly on a tier counts as reached", () => {
  const p = tierProgress(42);
  expect(p.reached).toBe(1);
  expect(p.next?.short).toBe("T2");
  expect(p.gap).toBe(32);
});

test("at/over the top — Super Bonus, no next", () => {
  const p = tierProgress(158);
  expect(p.reached).toBe(4);
  expect(p.next).toBeNull();
  expect(p.gap).toBe(0);
  expect(p.top).toBe(true);
  expect(tierProgress(200).top).toBe(true);
});
