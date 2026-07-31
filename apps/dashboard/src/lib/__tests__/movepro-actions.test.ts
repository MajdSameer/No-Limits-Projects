import { describe, expect, it } from "vitest";

import {
  dashcardUrl,
  extractEmbedJwt,
  extractRows,
  parseActionAgentName,
  sumRowsByAgent,
  type ActionRow,
} from "../movepro-actions";

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

// Verified live response shapes (2026-07-31) — see PR discussion for the exact
// externally-confirmed request/response pair each of these guards against.
describe("extractEmbedJwt", () => {
  const MINT_FIXTURE = {
    report: {
      metabase_token:
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyZXNvdXJjZSI6eyJkYXNoYm9hcmQiOjE2N30sInBhcmFtcyI6e319.9y8x7w6v5u4t3s2r1q0p",
    },
  };

  it("reads the JWT from report.metabase_token", () => {
    expect(extractEmbedJwt(MINT_FIXTURE)).toBe(MINT_FIXTURE.report.metabase_token);
  });

  it("throws a diagnosable error when the shape doesn't match", () => {
    expect(() => extractEmbedJwt({ token: "not-where-we-look" })).toThrow(/report\.metabase_token/);
    expect(() => extractEmbedJwt({ report: {} })).toThrow(/report\.metabase_token/);
    expect(() => extractEmbedJwt(null)).toThrow(/report\.metabase_token/);
  });
});

describe("extractRows", () => {
  const DASHCARD_FIXTURE = {
    status: "completed",
    data: {
      rows: [
        ["ord-1", "REF-1", "Ann Ablahad", "Cust A", "won", "2026-07-31T00:00:00Z", 5, 2, 2, 1],
        ["ord-2", "REF-2", "Luka No Limits", "Cust B", "won", "2026-07-31T01:00:00Z", 3, 1, 1, 1],
      ],
    },
  };

  it("reads rows from data.rows", () => {
    expect(extractRows(DASHCARD_FIXTURE)).toEqual(DASHCARD_FIXTURE.data.rows);
  });

  it("throws a diagnosable error when the shape doesn't match", () => {
    expect(() => extractRows({ status: "completed" })).toThrow(/unexpected response shape/);
  });
});

describe("dashcardUrl", () => {
  it("URL-encodes the parameters JSON to match the verified query shape", () => {
    const url = dashcardUrl("JWT123", "thisday");
    expect(url).toBe(
      "https://movepro.metabaseapp.com/api/embed/dashboard/JWT123/dashcard/269/card/628?parameters=%7B%22date%22%3A%22thisday%22%7D",
    );
  });

  it("includes sales_agent when provided (truncation-guard re-query)", () => {
    const url = dashcardUrl("JWT123", "2026-07-01~2026-07-01", "Ann Ablahad");
    expect(url).toContain("parameters=%7B%22date%22%3A%222026-07-01~2026-07-01%22%2C%22sales_agent%22%3A%22Ann%20Ablahad%22%7D");
  });
});
