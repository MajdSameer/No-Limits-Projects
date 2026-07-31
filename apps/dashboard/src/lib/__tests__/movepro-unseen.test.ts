import { describe, expect, it } from "vitest";

import { cardQueryUrl, extractUnseenRows, toUnseenDTO, type UnseenRow } from "../movepro-unseen";

describe("toUnseenDTO", () => {
  it("normalises names the same way as the activity board", () => {
    const rows: UnseenRow[] = [["Thomas Issac NoLimits", 3, 2, 1]];
    expect(toUnseenDTO(rows)[0]!.name).toBe("Issac");
  });

  it("keeps 'Unassigned' as-is — meaningful here, unlike the activity board's exclusion list", () => {
    const rows: UnseenRow[] = [["Unassigned", 12, 8, 4]];
    const dto = toUnseenDTO(rows);
    expect(dto).toHaveLength(1);
    expect(dto[0]!.name).toBe("Unassigned");
  });

  it("treats null counts as 0", () => {
    const rows: UnseenRow[] = [["Ann Ablahad", null, null, null]];
    expect(toUnseenDTO(rows)[0]).toEqual({ name: "Ann", totalUnseen: 0, emailSms: 0, callsCallbacks: 0 });
  });

  it("skips rows with no user", () => {
    const rows: UnseenRow[] = [["", 5, 3, 2]];
    expect(toUnseenDTO(rows)).toHaveLength(0);
  });

  it("sorts by total unseen descending", () => {
    const rows: UnseenRow[] = [
      ["Ann Ablahad", 3, 2, 1],
      ["Luka No Limits", 9, 5, 4],
      ["Randee Naamo", 1, 1, 0],
    ];
    expect(toUnseenDTO(rows).map((r) => r.name)).toEqual(["Luka", "Ann", "Randee"]);
  });
});

describe("extractUnseenRows", () => {
  const CARD_QUERY_FIXTURE = {
    data: {
      cols: [{ name: "user" }, { name: "total_unseen" }, { name: "unseen_email_sms" }, { name: "unseen_calls_callbacks" }],
      rows: [
        ["Ann Ablahad", 3, 2, 1],
        ["Luka No Limits", 0, 0, 0],
      ],
    },
  };

  it("reads rows from data.rows", () => {
    expect(extractUnseenRows(CARD_QUERY_FIXTURE)).toEqual(CARD_QUERY_FIXTURE.data.rows);
  });

  it("throws a diagnosable error when the shape doesn't match", () => {
    expect(() => extractUnseenRows({ data: {} })).toThrow(/unexpected response shape/);
  });
});

describe("cardQueryUrl", () => {
  it("builds the question-embed query URL", () => {
    expect(cardQueryUrl("JWT123")).toBe("https://movepro.metabaseapp.com/api/embed/card/JWT123/query");
  });
});
