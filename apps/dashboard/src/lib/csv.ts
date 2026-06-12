/** RFC 4180 CSV encoding — quotes fields containing comma, quote or newline. */
export function csvField(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

export function csvLine(values: unknown[]): string {
  return values.map(csvField).join(",");
}

export function toCsv(header: string[], rows: unknown[][]): string {
  return [csvLine(header), ...rows.map(csvLine)].join("\r\n") + "\r\n";
}
