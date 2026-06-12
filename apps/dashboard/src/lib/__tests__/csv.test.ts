import { expect, test } from "vitest";

import { csvField, toCsv } from "../csv";

test("plain fields pass through; dangerous ones get quoted+escaped", () => {
  expect(csvField("98RRX")).toBe("98RRX");
  expect(csvField(null)).toBe("");
  expect(csvField('Sherae "Shaz" Greenway')).toBe('"Sherae ""Shaz"" Greenway"');
  expect(csvField("Greystanes, NSW")).toBe('"Greystanes, NSW"');
  expect(csvField("line1\nline2")).toBe('"line1\nline2"');
});

test("toCsv emits CRLF rows with header", () => {
  const out = toCsv(["a", "b"], [["1", "x,y"]]);
  expect(out).toBe('a,b\r\n1,"x,y"\r\n');
});
