import { expect, test } from "vitest";

import { crossedThreshold, GONG_THRESHOLD, newBookings } from "../celebrate";

const row = (staffId: string, count: number) => ({ staffId, name: staffId, count });

test("threshold is 3", () => {
  expect(GONG_THRESHOLD).toBe(3);
});

test("crossedThreshold returns reps that reached the threshold and weren't seen", () => {
  const seen = new Set<string>();
  const fresh = crossedThreshold([row("a", 3), row("b", 2), row("c", 5)], seen, 3);
  expect(fresh.sort()).toEqual(["a", "c"]);
  expect([...seen].sort()).toEqual(["a", "c"]);
});

// ── newBookings: fire once per booking, deduped by MovePro job code ──

test("seed pass records codes but fires nothing", () => {
  const codes = new Set<string>();
  const counts = new Map<string, number>();
  const pops = newBookings(
    [{ staffId: "a", name: "Andy", count: 2, jobCodes: ["X1", "X2"] }],
    codes,
    counts,
    true,
  );
  expect(pops).toEqual([]);
  expect(codes.has("X1") && codes.has("X2")).toBe(true);
});

test("a new code fires once, and never again as the count bounces (stale instances)", () => {
  const codes = new Set<string>(["X1", "X2"]);
  const counts = new Map<string, number>();
  // new booking X3
  expect(
    newBookings([{ staffId: "a", name: "Andy", count: 3, jobCodes: ["X1", "X2", "X3"] }], codes, counts, false),
  ).toEqual([{ staffId: "a", name: "Andy", code: "X3" }]);
  // a stale poll shows only 2 codes — no fire
  expect(
    newBookings([{ staffId: "a", name: "Andy", count: 2, jobCodes: ["X1", "X2"] }], codes, counts, false),
  ).toEqual([]);
  // back to 3 — X3 already seen, so it does NOT re-fire
  expect(
    newBookings([{ staffId: "a", name: "Andy", count: 3, jobCodes: ["X1", "X2", "X3"] }], codes, counts, false),
  ).toEqual([]);
});

test("a rep with no job codes uses a per-rep high-water count", () => {
  const codes = new Set<string>();
  const counts = new Map<string, number>([["a", 2]]);
  expect(newBookings([row("a", 3)], codes, counts, false)).toEqual([
    { staffId: "a", name: "a", code: null },
  ]);
  // bounce down then back up — never re-fires
  expect(newBookings([row("a", 2)], codes, counts, false)).toEqual([]);
  expect(newBookings([row("a", 3)], codes, counts, false)).toEqual([]);
});

test("the new day's fresh codes fire (old codes already seen)", () => {
  const codes = new Set<string>(["OLD1", "OLD2"]);
  const counts = new Map<string, number>();
  expect(
    newBookings([{ staffId: "a", name: "Andy", count: 1, jobCodes: ["NEW1"] }], codes, counts, false),
  ).toEqual([{ staffId: "a", name: "Andy", code: "NEW1" }]);
});
