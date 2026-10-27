import { describe, expect, it } from "vitest";

import { cardQueryUrl, extractUnseenRows, toUnseenDTO, type UnseenRow } from "../movepro-unseen";

describe("toUnseenDTO", () => {
  it("normalises names the same way as the activity board", () => {
    const rows: UnseenRow[] = [["Thomas Issac NoLimits", 3, 2, 1]];
    expect(toUnseenDTO(rows)[0]!.name).toBe("Issac");
  });

  it("excludes the same non-rep names as the activity board, including 'Unassigned'", () => {
    const rows: UnseenRow[] = [
      ["Ann Ablahad", 3, 2, 1],
      ["Unassigned", 12, 8, 4],
      ["Andy", 1, 1, 0],
      ["Youi", 1, 1, 0],
      ["Hermez", 1, 1, 0],
      ["kinan", 2, 2, 0],
      ["Liam", 2, 2, 0],
      ["Sales", 3, 3, 0],
    ];
    const dto = toUnseenDTO(rows);
    expect(dto.map((r) => r.name)).toEqual(["Ann"]);
  });

  it("merges several accounts for one person into ONE row, summing their unseen counts", () => {
    const rows: UnseenRow[] = [
      ["Hadeel NoLimits", 5, 3, 2],
      ["Hadeel Smith", 4, 4, 0],
      ["Hadeel", 1, 0, 1],
      ["Isaac Jones", 2, 2, 0],
      ["Issac NoLimits", 3, 1, 2],
      ["anthony", 1, 1, 0],
    ];
    const dto = toUnseenDTO(rows);
    expect(dto.filter((r) => r.name === "Hadeel")).toHaveLength(1);
    expect(dto.find((r) => r.name === "Hadeel")).toEqual({ name: "Hadeel", totalUnseen: 10, emailSms: 7, callsCallbacks: 3 });
    expect(dto.find((r) => r.name === "Issac")).toEqual({ name: "Issac", totalUnseen: 5, emailSms: 3, callsCallbacks: 2 });
    expect(dto.map((r) => r.name)).toContain("Anthony");
    expect(new Set(dto.map((r) => r.name)).size).toBe(dto.length);
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
