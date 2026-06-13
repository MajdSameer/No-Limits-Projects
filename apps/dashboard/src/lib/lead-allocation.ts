/**
 * Live lead allocation. Eligible = clocked in AND not on break (per the
 * sheet: reps don't receive leads during breaks). Each eligible rep's fair
 * share is proportional to their intake weight; "next up" is whoever is
 * furthest below their fair share of today's leads so far.
 */

export type ClockStatus = "off" | "on" | "break" | "done";

export interface AllocCandidate {
  staffId: string;
  name: string;
  weight: number;
  status: ClockStatus;
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
  const sumWeight = eligible.reduce((s, c) => s + c.weight, 0);

  if (eligible.length === 0 || sumWeight === 0) {
    return { eligible: [], nextUp: null, totalLeadsToday };
  }

  const slots: AllocSlot[] = eligible.map((c) => {
    const sharePct = (c.weight / sumWeight) * 100;
    // Fair share of the NEXT lead being added to the eligible pool.
    const eligibleLeads = eligible.reduce((s, e) => s + e.leadsToday, 0);
    const owed = (c.weight / sumWeight) * (eligibleLeads + 1) - c.leadsToday;
    return {
      staffId: c.staffId,
      name: c.name,
      weight: c.weight,
      sharePct,
      leadsToday: c.leadsToday,
      owed,
    };
  });

  // Sort by most owed (desc), tiebreak fewest leads then name for stability.
  slots.sort(
    (a, b) =>
      b.owed - a.owed || a.leadsToday - b.leadsToday || a.name.localeCompare(b.name),
  );

  return { eligible: slots, nextUp: slots[0]?.staffId ?? null, totalLeadsToday };
}
