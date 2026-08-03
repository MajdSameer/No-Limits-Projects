/**
 * Monthly sales incentive tiers. Thresholds are total sales for the month:
 *   Tier 1 = 60, Tier 2 = 90, Tier 3 = 130, Tier 4 = 175, Super Bonus = 210.
 * Super Bonus is its own tier above Tier 4, not an alias for it — the board
 * shows each rep how far they are off their next tier, all the way up to
 * Super Bonus.
 */
export interface Tier {
  name: string;
  short: string;
  at: number;
}

export const TIERS: Tier[] = [
  { name: "Tier 1", short: "T1", at: 60 },
  { name: "Tier 2", short: "T2", at: 90 },
  { name: "Tier 3", short: "T3", at: 130 },
  { name: "Tier 4", short: "T4", at: 175 },
  { name: "Super Bonus", short: "SB", at: 210 },
];

/** Hitting the top tier (210) is the Super Bonus. */
export const SUPER_BONUS_AT = 210;

export interface TierProgress {
  /** How many tiers are fully reached (0–5, including Super Bonus). */
  reached: number;
  /** Highest tier reached, or null if below Tier 1. */
  reachedName: string | null;
  /** The next tier to chase, or null once topped out. */
  next: Tier | null;
  /** Sales still needed to reach `next` (0 once topped out). */
  gap: number;
  /** True once at/over the Super Bonus (top) tier. */
  top: boolean;
}

export function tierProgress(count: number): TierProgress {
  const n = Math.max(0, Math.floor(count));
  let reached = 0;
  for (const t of TIERS) if (n >= t.at) reached += 1;
  const next = reached < TIERS.length ? TIERS[reached]! : null;
  return {
    reached,
    reachedName: reached > 0 ? TIERS[reached - 1]!.name : null,
    next,
    gap: next ? next.at - n : 0,
    top: n >= SUPER_BONUS_AT,
  };
}
