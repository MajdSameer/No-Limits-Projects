import { describe, expect, it } from "vitest";

import {
  dashcardUrl,
  extractRows,
  mapWithConcurrency,
  mtdDailyAverages,
  parseActionAgentName,
  sumRowsByAgent,
  toDTO,
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

describe("toDTO", () => {
  function row(agent: string): ActionRow {
    return ["o1", "r1", agent, "cust", "status", "2026-07-01", 5, 2, 2, 1];
  }

  it("excludes non-rep names (inspectors, inactive staff, placeholders) case-insensitively", () => {
    const rows: ActionRow[] = [
      row("Ann Ablahad"),
      row("Liam"),
      row("Max"),
      row("Danny"),
      row("Unassigned"),
      row("kate"), // lowercase — must still match
      row("Youi"),
      row("Avan"),
      row("Hermez"),
      row("Ace"),
      row("MARTIN"), // uppercase — must still match
      row("Andy"),
      row("kinan"),
    ];
    const dto = toDTO(sumRowsByAgent(rows));
    expect(dto.map((r) => r.name)).toEqual(["Ann"]);
  });
});

describe("mtdDailyAverages", () => {
  function row(agent: string, total: number): ActionRow {
    return ["o1", "r1", agent, "cust", "status", "2026-07-01", total, 0, 0, 0];
  }

  it("averages prior-days-only total (monthly minus today) over priorDaysCount", () => {
    const monthly = sumRowsByAgent([row("Ann Ablahad", 300)]); // includes today's 50
    const daily = sumRowsByAgent([row("Ann Ablahad", 50)]); // today's contribution
    const avgs = mtdDailyAverages(monthly, daily, 5);
    expect(avgs.get("Ann")).toBe((300 - 50) / 5);
  });

  it("returns empty when there are no prior days yet (e.g. the 1st of the month)", () => {
    const monthly = sumRowsByAgent([row("Ann Ablahad", 50)]);
    const daily = sumRowsByAgent([row("Ann Ablahad", 50)]);
    expect(mtdDailyAverages(monthly, daily, 0).size).toBe(0);
  });

  it("treats a null dailyMap (today's fetch failed) as zero today-contribution", () => {
    const monthly = sumRowsByAgent([row("Ann Ablahad", 300)]);
    const avgs = mtdDailyAverages(monthly, null, 5);
    expect(avgs.get("Ann")).toBe(300 / 5);
  });

  it("excludes non-rep names", () => {
    const monthly = sumRowsByAgent([row("Ann Ablahad", 300), row("Liam", 300)]);
    const avgs = mtdDailyAverages(monthly, null, 5);
    expect([...avgs.keys()]).toEqual(["Ann"]);
  });

  it("sums across raw agent-name variants that parse to the same display name", () => {
    const monthly = sumRowsByAgent([row("Ann Ablahad", 200), row("Ann NoLimits", 100)]);
    const avgs = mtdDailyAverages(monthly, null, 3);
    expect(avgs.get("Ann")).toBe((200 + 100) / 3);
  });
});

// Verified live response shapes (2026-07-31) — see PR discussion for the exact
// externally-confirmed request/response pair each of these guards against.
// extractEmbedJwt is tested in movepro-client.test.ts (its canonical home —
// movepro-actions.ts only re-exports it for backward-compatible imports).

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

describe("mapWithConcurrency", () => {
  it("preserves input order regardless of completion order", async () => {
    const delays = [30, 10, 20, 5]; // item 0 resolves last, item 3 resolves first
    const result = await mapWithConcurrency(delays, 4, (ms) => new Promise((r) => setTimeout(() => r(ms), ms)));
    expect(result).toEqual(delays);
  });

  it("never runs more than `limit` calls at once", async () => {
    const items = Array.from({ length: 10 }, (_, i) => i);
    let inFlight = 0;
    let maxInFlight = 0;
    await mapWithConcurrency(items, 3, async () => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
    });
    expect(maxInFlight).toBeLessThanOrEqual(3);
    expect(maxInFlight).toBeGreaterThan(1); // sanity: it did run concurrently, not serially
  });

  it("runs every item even when limit exceeds the item count", async () => {
    const items = [1, 2, 3];
    const result = await mapWithConcurrency(items, 10, (n) => Promise.resolve(n * 2));
    expect(result).toEqual([2, 4, 6]);
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
