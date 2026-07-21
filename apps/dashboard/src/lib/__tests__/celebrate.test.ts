import { expect, test } from "vitest";

import {
  createCelebrateState,
  crossedThreshold,
  GONG_THRESHOLD,
  inspectorBookings,
  newBookings,
} from "../celebrate";

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

// ── newBookings: one pop per booking, count-driven, codes are labels ──

test("seed pass records state but fires nothing", () => {
  const s = createCelebrateState();
  const pops = newBookings(
    [{ staffId: "a", name: "Andy", count: 2, jobCodes: ["X1", "X2"] }],
    s,
    true,
  );
  expect(pops).toEqual([]);
  expect(s.fired.get("a")).toBe(2);
  expect(s.seenCodes.has("X1") && s.seenCodes.has("X2")).toBe(true);
});

test("a new booking fires once, and a single stale dip never re-fires it", () => {
  const s = createCelebrateState();
  newBookings([{ staffId: "a", name: "Andy", count: 2, jobCodes: ["X1", "X2"] }], s, true);
  // new booking X3
  expect(
    newBookings([{ staffId: "a", name: "Andy", count: 3, jobCodes: ["X1", "X2", "X3"] }], s, false),
  ).toEqual([{ staffId: "a", name: "Andy", code: "X3" }]);
  // a single stale poll shows only 2 — a blip, debounced away
  expect(
    newBookings([{ staffId: "a", name: "Andy", count: 2, jobCodes: ["X1", "X2"] }], s, false),
  ).toEqual([]);
  // back to 3 — must NOT re-fire (the dip never persisted)
  expect(
    newBookings([{ staffId: "a", name: "Andy", count: 3, jobCodes: ["X1", "X2", "X3"] }], s, false),
  ).toEqual([]);
});

test("deleting a booking and re-entering it later celebrates again (with its code)", () => {
  const s = createCelebrateState();
  newBookings([{ staffId: "a", name: "Andy", count: 3, jobCodes: ["A1", "A2", "A3"] }], s, true);
  // delete A3 — the drop must persist before we trust it
  expect(
    newBookings([{ staffId: "a", name: "Andy", count: 2, jobCodes: ["A1", "A2"] }], s, false),
  ).toEqual([]); // 1st low poll — not yet trusted
  expect(
    newBookings([{ staffId: "a", name: "Andy", count: 2, jobCodes: ["A1", "A2"] }], s, false),
  ).toEqual([]); // 2nd low poll — delete accepted
  // put it back in — celebrates + gongs again, showing the number again
  expect(
    newBookings([{ staffId: "a", name: "Andy", count: 3, jobCodes: ["A1", "A2", "A3"] }], s, false),
  ).toEqual([{ staffId: "a", name: "Andy", code: "A3" }]);
});

test("a codeless rep also re-celebrates after a persistent delete", () => {
  const s = createCelebrateState();
  newBookings([row("a", 2)], s, true);
  // 3rd booking, no codes — fires code-less
  expect(newBookings([row("a", 3)], s, false)).toEqual([{ staffId: "a", name: "a", code: null }]);
  // single stale dip — ignored
  expect(newBookings([row("a", 2)], s, false)).toEqual([]);
  expect(newBookings([row("a", 3)], s, false)).toEqual([]);
  // a real, persistent delete then re-add — re-fires
  expect(newBookings([row("a", 2)], s, false)).toEqual([]); // low poll 1
  expect(newBookings([row("a", 2)], s, false)).toEqual([]); // low poll 2 — accepted
  expect(newBookings([row("a", 3)], s, false)).toEqual([{ staffId: "a", name: "a", code: null }]);
});

test("keeps celebrating past the codes the sheet pushes (6th booking, capped codes)", () => {
  const s = createCelebrateState();
  newBookings(
    [{ staffId: "a", name: "Jenifer", count: 5, jobCodes: ["A1", "A2", "A3", "A4", "A5"] }],
    s,
    true,
  );
  // 6th booking lands but the sheet still only pushes 5 codes — fires code-less
  expect(
    newBookings(
      [{ staffId: "a", name: "Jenifer", count: 6, jobCodes: ["A1", "A2", "A3", "A4", "A5"] }],
      s,
      false,
    ),
  ).toEqual([{ staffId: "a", name: "Jenifer", code: null }]);
});

test("a jump of several bookings at once fires one pop per booking", () => {
  const s = createCelebrateState();
  s.fired.set("a", 1);
  expect(
    newBookings([{ staffId: "a", name: "Andy", count: 3, jobCodes: ["B2", "B3"] }], s, false),
  ).toEqual([
    { staffId: "a", name: "Andy", code: "B2" },
    { staffId: "a", name: "Andy", code: "B3" },
  ]);
});

test("without a day key, a fast overnight reset can silently swallow the first booking of the new day", () => {
  // Reproduces the reported bug on an always-on wall (never reloads): if the
  // count reset to 0 and the day's first booking both land between the same
  // two polls, DROP_PERSIST accepts the drop as the new floor before ever
  // seeing an increase — the first booking never pops. This documents the
  // failure mode with no `day` passed; the next test shows the fix.
  const s = createCelebrateState();
  newBookings([row("a", 5)], s, true); // yesterday ends at 5
  expect(newBookings([row("a", 1)], s, false)).toEqual([]); // low poll 1 (reset+1st booking already landed)
  expect(newBookings([row("a", 1)], s, false)).toEqual([]); // low poll 2 — drop accepted, no pop for booking #1
  expect(newBookings([row("a", 2)], s, false)).toEqual([{ staffId: "a", name: "a", code: null }]); // only #2 pops
});

test("a day key resets the high-water immediately, so the first booking of a new day still fires", () => {
  const s = createCelebrateState();
  newBookings([row("a", 5)], s, true, "2026-07-21"); // yesterday ends at 5
  // New day: reset + first booking land in the same poll — must still pop.
  expect(newBookings([row("a", 1)], s, false, "2026-07-22")).toEqual([
    { staffId: "a", name: "a", code: null },
  ]);
  // Same day, no further change.
  expect(newBookings([row("a", 1)], s, false, "2026-07-22")).toEqual([]);
});

test("day-rollover reset applies to inspectorBookings too", () => {
  const s = createCelebrateState();
  inspectorBookings(
    [{ staffId: "martin", name: "Martin", count: 4, jobs: [{ code: "A1", forRep: "Ann" }] }],
    s,
    true,
    "2026-07-21",
  );
  expect(
    inspectorBookings(
      [{ staffId: "martin", name: "Martin", count: 1, jobs: [{ code: "B1", forRep: "Hadeel" }] }],
      s,
      false,
      "2026-07-22",
    ),
  ).toEqual([{ staffId: "martin", name: "Martin", code: "B1", kind: "inspector", forRep: "Hadeel" }]);
});

test("the new day's fresh codes fire (old codes already labelled)", () => {
  const s = createCelebrateState();
  s.seenCodes.add("OLD1");
  s.seenCodes.add("OLD2");
  expect(
    newBookings([{ staffId: "a", name: "Andy", count: 1, jobCodes: ["NEW1"] }], s, false),
  ).toEqual([{ staffId: "a", name: "Andy", code: "NEW1" }]);
});

// ── inspectorBookings: per-inspection pop, tagged with the sales rep ──

test("a new site inspection fires once, tagged inspector + the sales rep it's for", () => {
  const s = createCelebrateState();
  inspectorBookings(
    [{ staffId: "martin", name: "Martin", count: 1, jobs: [{ code: "J1", forRep: "Hadeel" }] }],
    s,
    true, // seed — silent
  );
  expect(
    inspectorBookings(
      [
        {
          staffId: "martin",
          name: "Martin",
          count: 2,
          jobs: [
            { code: "J1", forRep: "Hadeel" },
            { code: "J2", forRep: "Jenifer" },
          ],
        },
      ],
      s,
      false,
    ),
  ).toEqual([{ staffId: "martin", name: "Martin", code: "J2", kind: "inspector", forRep: "Jenifer" }]);
});

test("a 4th inspection reusing an earlier job code still fires (repeated code, no fresh label)", () => {
  // Reproduces the reported bug: Martin's 3rd and 4th inspections both had job
  // code XXMZD for the same sales rep. Every row he submits must still pop.
  const s = createCelebrateState();
  inspectorBookings(
    [
      {
        staffId: "martin",
        name: "Martin",
        count: 3,
        jobs: [
          { code: "Q35K9", forRep: "Isaac" },
          { code: "B6MYA", forRep: "Mariam" },
          { code: "XXMZD", forRep: "Jesecca" },
        ],
      },
    ],
    s,
    true, // seed — silent
  );
  expect(
    inspectorBookings(
      [
        {
          staffId: "martin",
          name: "Martin",
          count: 4,
          jobs: [
            { code: "Q35K9", forRep: "Isaac" },
            { code: "B6MYA", forRep: "Mariam" },
            { code: "XXMZD", forRep: "Jesecca" },
            { code: "XXMZD", forRep: "Jesecca" },
          ],
        },
      ],
      s,
      false,
    ),
  ).toEqual([{ staffId: "martin", name: "Martin", code: null, kind: "inspector", forRep: null }]);
});

test("a site inspection with no known sales rep still fires (forRep null)", () => {
  const s = createCelebrateState();
  expect(
    inspectorBookings(
      [{ staffId: "danny", name: "Danny", count: 1, jobs: [{ code: "K9", forRep: null }] }],
      s,
      false,
    ),
  ).toEqual([{ staffId: "danny", name: "Danny", code: "K9", kind: "inspector", forRep: null }]);
});
