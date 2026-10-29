import { expect, test } from "vitest";

process.env.PGLITE_DIR = ":memory:";
const { getDb } = await import("../client");
const { addAnnouncement, announcementsAfter, latestAnnouncementKey } = await import("../announcements");
await getDb();

test("announcements round-trip, in order, and only newer-than-cursor come back", async () => {
  expect(await latestAnnouncementKey()).toBeNull();

  const t = Date.now();
  const a = await addAnnouncement({ job: "4EX6RD", by: "Danny", forRep: "Jessica" }, t);
  expect(a.duplicate).toBe(false);
  const baseline = await latestAnnouncementKey();
  expect(baseline).toBe(a.announcement.key);

  // Nothing newer than the baseline yet — a freshly-loaded screen shows nothing.
  expect(await announcementsAfter(baseline!)).toEqual([]);

  const b = await addAnnouncement({ job: "7833MY", by: "Danny", forRep: "Anthony" }, t + 5);
  const c = await addAnnouncement({ job: "PZGGKR", by: "Martin", forRep: "Lara" }, t + 10);
  const after = await announcementsAfter(baseline!);
  expect(after.map((x) => x.job)).toEqual(["7833MY", "PZGGKR"]);
  expect(after[0]).toMatchObject({ by: "Danny", forRep: "Anthony", key: b.announcement.key });
  expect(await latestAnnouncementKey()).toBe(c.announcement.key);
});

test("the same job number twice within 2 minutes is a duplicate (no second celebration)", async () => {
  const t = Date.now() + 1_000_000;
  const first = await addAnnouncement({ job: "DUPE12", by: "Danny", forRep: "Ann" }, t);
  const second = await addAnnouncement({ job: "DUPE12", by: "Danny", forRep: "Ann" }, t + 30_000);
  expect(first.duplicate).toBe(false);
  expect(second.duplicate).toBe(true);
  expect(second.announcement.key).toBe(first.announcement.key);

  // After the dedupe window the same number can announce again.
  const third = await addAnnouncement({ job: "DUPE12", by: "Danny", forRep: "Ann" }, t + 3 * 60_000);
  expect(third.duplicate).toBe(false);
});

test("old announcements are pruned", async () => {
  const now = Date.now() + 10_000_000;
  const old = await addAnnouncement({ job: "OLD111", by: "X", forRep: "Y" }, now - 4 * 24 * 3600 * 1000);
  await addAnnouncement({ job: "NEW111", by: "X", forRep: "Y" }, now); // triggers the prune
  const all = await announcementsAfter("ann:");
  expect(all.find((x) => x.key === old.announcement.key)).toBeUndefined();
  expect(all.find((x) => x.job === "NEW111")).toBeDefined();
});
