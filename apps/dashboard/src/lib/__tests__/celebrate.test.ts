import { expect, test } from "vitest";

import { crossedThreshold, GONG_THRESHOLD, risenBookings } from "../celebrate";

const row = (staffId: string, count: number) => ({ staffId, name: staffId, count });

test("threshold is 3", () => {
  expect(GONG_THRESHOLD).toBe(3);
});

test("returns reps that reached the threshold and weren't seen", () => {
  const seen = new Set<string>();
  const fresh = crossedThreshold([row("a", 3), row("b", 2), row("c", 5)], seen, 3);
  expect(fresh.sort()).toEqual(["a", "c"]);
  expect([...seen].sort()).toEqual(["a", "c"]);
});

test("does not re-fire for reps already seen", () => {
  const seen = new Set<string>(["a"]);
  const fresh = crossedThreshold([row("a", 4), row("b", 3)], seen, 3);
  expect(fresh).toEqual(["b"]);
});

test("below threshold never fires", () => {
  expect(crossedThreshold([row("a", 0), row("b", 2)], new Set(), 3)).toEqual([]);
});

// ── risenBookings: fire on every increment, carry the latest MovePro code ──

test("first call only seeds — nothing fires on a fresh load", () => {
  const prev = new Map<string, number>();
  expect(risenBookings([row("a", 5), row("b", 2)], prev)).toEqual([]);
  expect(prev.get("a")).toBe(5);
  expect(prev.get("b")).toBe(2);
});

test("fires once per rep whose count rose, with the newest job code", () => {
  const prev = new Map<string, number>([
    ["a", 2],
    ["b", 2],
  ]);
  const pops = risenBookings(
    [
      { staffId: "a", name: "Andy", count: 3, jobCodes: ["X1", "X2", "VEPQ8"] },
      { staffId: "b", name: "Bea", count: 2 }, // unchanged — no pop
    ],
    prev,
  );
  expect(pops).toEqual([{ staffId: "a", name: "Andy", code: "VEPQ8" }]);
  expect(prev.get("a")).toBe(3);
});

test("a rep with no job codes still pops (code null)", () => {
  const prev = new Map<string, number>([["a", 0]]);
  expect(risenBookings([row("a", 1)], prev)).toEqual([{ staffId: "a", name: "a", code: null }]);
});

test("a count going down (new day reset) never fires", () => {
  const prev = new Map<string, number>([["a", 8]]);
  expect(risenBookings([row("a", 0)], prev)).toEqual([]);
  expect(prev.get("a")).toBe(0);
});
