import { describe, expect, it } from "vitest";

import { crossedGongThreshold } from "../actions-gong";

function row(name: string, calls: number, emails: number, messages: number) {
  return { name, calls, emails, messages };
}

describe("crossedGongThreshold", () => {
  it("fires when a rep's metric crosses 100", () => {
    const seen = new Set<string>();
    const events = crossedGongThreshold([row("Ann", 100, 50, 50)], seen, false);
    expect(events).toEqual([{ name: "Ann", metric: "calls", value: 100 }]);
    expect(seen.has("Ann|calls")).toBe(true);
  });

  it("fires independently per metric in the same call", () => {
    const seen = new Set<string>();
    const events = crossedGongThreshold([row("Ann", 100, 100, 50)], seen, false);
    expect(events.map((e) => e.metric).sort()).toEqual(["calls", "emails"]);
  });

  it("does not re-fire for a rep+metric already in seen", () => {
    const seen = new Set<string>(["Ann|calls"]);
    const events = crossedGongThreshold([row("Ann", 105, 50, 50)], seen, false);
    expect(events).toEqual([]);
  });

  it("does not fire below the threshold", () => {
    const seen = new Set<string>();
    const events = crossedGongThreshold([row("Ann", 99, 99, 99)], seen, false);
    expect(events).toEqual([]);
    expect(seen.size).toBe(0);
  });

  it("on a seed pass, marks everything currently over as seen without firing", () => {
    const seen = new Set<string>();
    const events = crossedGongThreshold([row("Ann", 150, 50, 50)], seen, true);
    expect(events).toEqual([]);
    expect(seen.has("Ann|calls")).toBe(true);
  });

  it("after a seed pass, a later real crossing for a different metric still fires", () => {
    const seen = new Set<string>();
    crossedGongThreshold([row("Ann", 150, 50, 50)], seen, true); // seed: calls already over
    const events = crossedGongThreshold([row("Ann", 150, 100, 50)], seen, false); // emails just crossed
    expect(events).toEqual([{ name: "Ann", metric: "emails", value: 100 }]);
  });

  it("fires for multiple reps in one call", () => {
    const seen = new Set<string>();
    const events = crossedGongThreshold([row("Ann", 100, 0, 0), row("Luka", 100, 0, 0)], seen, false);
    expect(events.map((e) => e.name).sort()).toEqual(["Ann", "Luka"]);
  });
});
