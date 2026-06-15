import { expect, test } from "vitest";

import { crossedThreshold, GONG_THRESHOLD } from "../celebrate";

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
