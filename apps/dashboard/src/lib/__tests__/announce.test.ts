import { describe, expect, it } from "vitest";

import { cleanName, newerThan, normalizeJob, parseAnnounceBody, type Announcement } from "../announce";

describe("normalizeJob", () => {
  it("upper-cases and strips #, spaces", () => {
    expect(normalizeJob("#4ex6rd ")).toBe("4EX6RD");
    expect(normalizeJob(" 38953a")).toBe("38953A");
  });
  it("rejects things that aren't a job number", () => {
    expect(normalizeJob("")).toBeNull();
    expect(normalizeJob("abc")).toBeNull(); // too short
    expect(normalizeJob("hello world!")).toBeNull();
    expect(normalizeJob("A".repeat(20))).toBeNull(); // too long
    expect(normalizeJob(123456 as unknown)).toBeNull();
  });
});

describe("cleanName", () => {
  it("trims, collapses whitespace and caps length", () => {
    expect(cleanName("  Anna   Lee ")).toBe("Anna Lee");
    expect(cleanName("x".repeat(100))).toHaveLength(40);
  });
  it("returns null for blank / non-strings", () => {
    expect(cleanName("   ")).toBeNull();
    expect(cleanName(undefined)).toBeNull();
  });
});

describe("parseAnnounceBody", () => {
  it("accepts a valid body and normalises it", () => {
    expect(parseAnnounceBody({ job: "#4ex6rd", by: " Danny ", forRep: "Jessica" })).toEqual({
      ok: true,
      value: { job: "4EX6RD", by: "Danny", forRep: "Jessica" },
    });
  });
  it("explains what's missing", () => {
    expect(parseAnnounceBody({ job: "x", by: "D", forRep: "J" })).toMatchObject({ ok: false });
    expect(parseAnnounceBody({ job: "4EX6RD", by: "", forRep: "J" })).toMatchObject({ ok: false, error: expect.stringMatching(/name/i) });
    expect(parseAnnounceBody({ job: "4EX6RD", by: "D", forRep: "" })).toMatchObject({ ok: false, error: expect.stringMatching(/for/i) });
    expect(parseAnnounceBody(null)).toMatchObject({ ok: false });
  });
});

describe("newerThan", () => {
  const a = (key: string): Announcement => ({ key, job: "X", by: "b", forRep: "f", at: 0 });
  it("returns only newer keys, oldest first, de-duplicated", () => {
    const items = [a("ann:0000000000003:c"), a("ann:0000000000001:a"), a("ann:0000000000002:b"), a("ann:0000000000002:b")];
    expect(newerThan(items, "ann:0000000000001:a").map((x) => x.key)).toEqual(["ann:0000000000002:b", "ann:0000000000003:c"]);
    expect(newerThan(items, null)).toHaveLength(3);
  });
});
