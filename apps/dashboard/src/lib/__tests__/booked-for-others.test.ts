import { describe, expect, it } from "vitest";

import type { Announcement } from "../announce";
import { tallyBookedForOthers } from "../booked-for-others";

// 2026-10-30 (Friday) midday Sydney.
const NOW = new Date("2026-10-30T01:00:00Z");
const ms = (iso: string) => new Date(iso).getTime();
let n = 0;
const a = (by: string, forRep: string, iso: string): Announcement => ({ key: `ann:${++n}`, job: `J${n}ABCD`, by, forRep, at: ms(iso) });
const roster = ["Jenifer", "Maritta", "Jessica", "Anthony"];

describe("tallyBookedForOthers", () => {
  it("counts per submitting rep, today and this month, sorted", () => {
    const rows = tallyBookedForOthers(
      [
        a("Jenifer", "Maritta", "2026-10-30T00:30:00Z"), // today
        a("Jenifer", "Anthony", "2026-10-30T02:00:00Z"), // today
        a("Jenifer", "Maritta", "2026-10-12T02:00:00Z"), // earlier this month
        a("Jessica", "Anthony", "2026-10-30T01:00:00Z"), // today
      ],
      roster,
      NOW,
    );
    expect(rows).toEqual([
      { name: "Jenifer", today: 2, month: 3 },
      { name: "Jessica", today: 1, month: 1 },
    ]);
  });

  it("ignores last month, non-roster submitters, and a rep booking for themselves", () => {
    const rows = tallyBookedForOthers(
      [
        a("Jenifer", "Maritta", "2026-09-29T02:00:00Z"), // last month
        a("Test", "Maritta", "2026-10-30T01:00:00Z"), // not a rep
        a("Maritta", "maritta", "2026-10-30T01:00:00Z"), // self
        a("jenifer", "Anthony", "2026-10-30T01:00:00Z"), // case-insensitive match → counts
      ],
      roster,
      NOW,
    );
    expect(rows).toEqual([{ name: "Jenifer", today: 1, month: 1 }]);
  });

  it("uses the Sydney calendar day, not UTC (a 11pm-Sydney booking is that Sydney day)", () => {
    // 2026-10-29T13:30Z = 00:30 on the 30th in Sydney (AEDT) → today.
    const rows = tallyBookedForOthers([a("Jessica", "Anthony", "2026-10-29T13:30:00Z")], roster, NOW);
    expect(rows).toEqual([{ name: "Jessica", today: 1, month: 1 }]);
  });
});
