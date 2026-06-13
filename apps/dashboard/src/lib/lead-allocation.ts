/**
 * Live lead allocation. Eligible = clocked in AND not on break (per the
 * sheet: reps don't receive leads during breaks). Each eligible rep's fair
 * share is proportional to their CAPACITY = intake weight × hours worked so
 * far today (the live allocator sheet's model — share of the day, not just
 * the moment). "Next up" is whoever is furthest below their fair share of
 * today's leads so far. Before anyone has accrued time at shift start, it
 * falls back to weight-only so the queue still functions.
 */

export type ClockStatus = "off" | "on" | "break" | "done";

export interface AllocCandidate {
  staffId: string;
  name: string;
  weight: number;
  status: ClockStatus;
  /** Hours clocked-and-working so far today (breaks excluded). */
  workedHours: number;
  leadsToday: number;
}

export interface AllocSlot {
  staffId: string;
  name: string;
  weight: number;
  sharePct: number; // 0..100 among eligible
  leadsToday: number;
  /** Fair share of (leadsToday total + 1); higher = more owed the next lead. */
  owed: number;
}

export interface Allocation {
  eligible: AllocSlot[];
  /** staffId of the rep who should get the next lead, or null if none eligible. */
  nextUp: string | null;
  totalLeadsToday: number;
}

export function allocate(candidates: AllocCandidate[]): Allocation {
  const eligible = candidates.filter((c) => c.status === "on" && c.weight > 0);
  const totalLeadsToday = candidates.reduce((s, c) => s + c.leadsToday, 0);
  if (eligible.length === 0) return { eligible: [], nextUp: null, totalLeadsToday };

  // Capacity = weight × hours worked. At shift start (no hours accrued yet)
  // fall back to weight alone so the queue still distributes.
  const hoursAccrued = eligible.reduce((s, c) => s + c.weight * Math.max(0, c.workedHours), 0);
  const capOf = (c: AllocCandidate) =>
    hoursAccrued > 0 ? c.weight * Math.max(0, c.workedHours) : c.weight;

  const sumCap = eligible.reduce((s, c) => s + capOf(c), 0);
  if (sumCap === 0) return { eligible: [], nextUp: null, totalLeadsToday };

  const eligibleLeads = eligible.reduce((s, e) => s + e.leadsToday, 0);
  const slots: AllocSlot[] = eligible.map((c) => {
    const share = capOf(c) / sumCap;
    return {
      staffId: c.staffId,
      name: c.name,
      weight: c.weight,
      sharePct: share * 100,
      leadsToday: c.leadsToday,
      // Fair share of the NEXT lead added to the eligible pool, minus taken.
      owed: share * (eligibleLeads + 1) - c.leadsToday,
    };
  });

  // Sort by most owed (desc), tiebreak fewest leads then name for stability.
  slots.sort(
    (a, b) => b.owed - a.owed || a.leadsToday - b.leadsToday || a.name.localeCompare(b.name),
  );

  return { eligible: slots, nextUp: slots[0]?.staffId ?? null, totalLeadsToday };
}
