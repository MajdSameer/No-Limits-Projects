/**
 * The /live headline "bookings this month" number. Prefer the Follow-Up sheet's
 * own grand total (it counts managers + tracked ex-reps the rep board omits), but
 * only when it's believable: that cell is a formula over an imported table, and
 * while the import is broken (#N/A) it evaluates to "Total bookings: 0" — which
 * the sheet script then pushed as a real total, blanking the headline to 0/goal
 * even though every rep row was fine. A zero (or a total less than half the rep
 * board's own sum) is treated as a broken read and falls back to the board sum.
 */
export function pickMonthlyTotal(sheetTotal: number | null, boardSum: number): number {
  if (sheetTotal == null || !Number.isFinite(sheetTotal)) return boardSum;
  if (sheetTotal <= 0 && boardSum > 0) return boardSum;
  if (sheetTotal < boardSum * 0.5) return boardSum;
  return sheetTotal;
}
