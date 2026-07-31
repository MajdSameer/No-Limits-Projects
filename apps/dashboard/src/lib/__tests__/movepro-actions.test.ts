import { describe, expect, it } from "vitest";

import { parseActionAgentName, sumRowsByAgent, type ActionRow } from "../movepro-actions";

describe("parseActionAgentName", () => {
  it("strips a NoLimits/No Limits suffix and takes the last remaining word", () => {
    expect(parseActionAgentName("Thomas Issac NoLimits")).toBe("Issac");
    expect(parseActionAgentName("Luka No Limits")).toBe("Luka");
  });

  it("takes the first word when there's no suffix", () => {
    expect(parseActionAgentName("Ann Ablahad")).toBe("Ann");
    expect(parseActionAgentName("Randee Naamo")).toBe("Randee");
  });

  it("handles a single-word name with no suffix", () => {
    expect(parseActionAgentName("Cher")).toBe("Cher");
  });

  it("handles the suffix being the only content left after stripping", () => {
    expect(parseActionAgentName("NoLimits")).toBe("NoLimits");
  });
});

describe("sumRowsByAgent", () => {
  function row(agent: string, total: number | null, calls: number | null, emails: number | null, messages: number | null): ActionRow {
    return ["o1", "r1", agent, "cust", "status", "2026-07-01", total, calls, emails, messages];
  }

  it("sums total_actions/calls/emails/messages per agent", () => {
    const rows: ActionRow[] = [row("Ann Ablahad", 5, 2, 2, 1), row("Ann Ablahad", 3, 1, 1, 1), row("Luka No Limits", 4, 4, 0, 0)];
    const result = sumRowsByAgent(rows);
    expect(result.get("Ann Ablahad")).toEqual({ totalActions: 8, calls: 3, emails: 3, messages: 2 });
    expect(result.get("Luka No Limits")).toEqual({ totalActions: 4, calls: 4, emails: 0, messages: 0 });
  });

  it("treats null counts as 0", () => {
    const rows: ActionRow[] = [row("Ann Ablahad", null, null, null, null)];
    const result = sumRowsByAgent(rows);
    expect(result.get("Ann Ablahad")).toEqual({ totalActions: 0, calls: 0, emails: 0, messages: 0 });
  });

  it("skips rows with no sales_agent", () => {
    const rows: ActionRow[] = [row("", 5, 1, 1, 1)];
    const result = sumRowsByAgent(rows);
    expect(result.size).toBe(0);
  });
});
