/**
 * Monthly sales incentive tiers. Thresholds are total sales for the month
 * (average sale/day × 21 working days):
 *   Tier 1 = 42, Tier 2 = 74, Tier 3 = 115, Tier 4 = 158.
 * Hitting Tier 4 (158) is the Super Bonus. The board shows each rep how far
 * they are off their next tier.
 */
export interface Tier {
  name: string;
  short: string;
  at: number;
}

export const TIERS: Tier[] = [
  { name: "Tier 1", short: "T1", at: 42 },
  { name: "Tier 2", short: "T2", at: 74 },
  { name: "Tier 3", short: "T3", at: 115 },
  { name: "Tier 4", short: "T4", at: 158 },
];

/** Hitting the top tier (158) is the Super Bonus. */
export const SUPER_BONUS_AT = 158;

export interface TierProgress {
  /** How many tiers are fully reached (0–4). */
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

/**
 * Commission rate (fraction of NET revenue) a rep earns, by the tier their
 * monthly sales count puts them in. Indexed by tiers reached (0–4):
 *   below Tier 1 → 0%, T1 → 1%, T2 → 1.5%, T3 → 1.75%,
 *   Tier 4 / Super Bonus (158) → 2.5%.
 * The estimated commission shown on the board is this rate × the rep's net
 * revenue for the month. To restore a distinct 2% Tier-4 band, change the last
 * entry and split the Super Bonus into its own threshold.
 */
export const COMMISSION_RATE_BY_TIER = [0, 0.01, 0.015, 0.0175, 0.025] as const;

/** The commission rate for a rep with `count` sales this month (0–0.025). */
export function commissionRate(count: number): number {
  return COMMISSION_RATE_BY_TIER[tierProgress(count).reached] ?? 0;
}
