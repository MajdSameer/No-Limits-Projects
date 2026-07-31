import { describe, expect, it } from "vitest";

import { extractEmbedJwt } from "../movepro-client";

// Verified live response shape (2026-07-31): { report: { metabase_token }}.
// Report 17 (dashboard embed) also nests resource: { dashboard }, report 9
// (question embed) nests resource: { question } — extractEmbedJwt only reads
// report.metabase_token, so both shapes parse identically.
describe("extractEmbedJwt", () => {
  const DASHBOARD_MINT_FIXTURE = {
    report: {
      resource: { dashboard: 167 },
      metabase_token:
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyZXNvdXJjZSI6eyJkYXNoYm9hcmQiOjE2N30sInBhcmFtcyI6e319.9y8x7w6v5u4t3s2r1q0p",
    },
  };

  const QUESTION_MINT_FIXTURE = {
    report: {
      resource: { question: 303 },
      metabase_token:
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyZXNvdXJjZSI6eyJxdWVzdGlvbiI6MzAzfSwicGFyYW1zIjp7fX0.a1b2c3d4e5f6g7h8",
    },
  };

  it("reads the JWT from report.metabase_token for a dashboard-embed mint response", () => {
    expect(extractEmbedJwt(DASHBOARD_MINT_FIXTURE)).toBe(DASHBOARD_MINT_FIXTURE.report.metabase_token);
  });

  it("reads the JWT from report.metabase_token for a question-embed mint response", () => {
    expect(extractEmbedJwt(QUESTION_MINT_FIXTURE)).toBe(QUESTION_MINT_FIXTURE.report.metabase_token);
  });

  it("throws a diagnosable error when the shape doesn't match", () => {
    expect(() => extractEmbedJwt({ token: "not-where-we-look" })).toThrow(/report\.metabase_token/);
    expect(() => extractEmbedJwt({ report: {} })).toThrow(/report\.metabase_token/);
    expect(() => extractEmbedJwt(null)).toThrow(/report\.metabase_token/);
  });
});
