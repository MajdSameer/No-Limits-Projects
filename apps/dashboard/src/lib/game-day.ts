/**
 * Pure Game Day logic for the /live/game-day wall — scoring, ranking, copy
 * and countdown maths with no React or DOM, so it's unit-tested in isolation.
 *
 * The scoring semantics here (team totals, leader on a tie, top scorer with
 * ties sharing the crown) are hand-mirrored by computeGameDayResult in
 * db/queries/game-day-results.ts for the nightly archive — change one, change
 * both, or the captured results drift from what the wall showed.
 */

/** DB/data value for a team. Display names/colours are the wall's concern —
 * these keys never change so BoardRowDTO.team needs no migration. */
export type Side = "orange" | "blue";

export const SIDES: readonly Side[] = ["orange", "blue"];

/** Game Day runs until 7 PM on the floor's clock. */
export const GAME_END_HOUR = 19;
export const SYDNEY_TZ = "Australia/Sydney";

/** Team-total milestones that get a small celebration toast. */
export const MILESTONES: readonly number[] = [5, 10, 15, 20, 25, 30, 40, 50];

export interface ScoreRowLike {
  staffId: string;
  name: string;
  count: number;
  team: string | null;
}

export interface ScoreState<T extends ScoreRowLike> {
  /** Every rep on a team, in the order received. */
  teamed: (T & { team: Side })[];
  orange: (T & { team: Side })[];
  blue: (T & { team: Side })[];
  orangeTotal: number;
  blueTotal: number;
  total: number;
  margin: number;
  /** null on a tie (including 0–0). */
  leader: Side | null;
  maxCount: number;
  /** Floor-wide top scorer(s): count > 0 and equal to maxCount — ties share it. */
  topIds: Set<string>;
}

function isSide(t: string | null): t is Side {
  return t === "orange" || t === "blue";
}

/** Split the daily board into the two teams and derive the scoreboard. */
export function scoreState<T extends ScoreRowLike>(daily: readonly T[]): ScoreState<T> {
  const teamed = daily.filter((r): r is T & { team: Side } => isSide(r.team));
  const orange = teamed.filter((r) => r.team === "orange");
  const blue = teamed.filter((r) => r.team === "blue");
  const orangeTotal = orange.reduce((s, r) => s + r.count, 0);
  const blueTotal = blue.reduce((s, r) => s + r.count, 0);
  const total = orangeTotal + blueTotal;
  const margin = Math.abs(orangeTotal - blueTotal);
  const leader: Side | null =
    orangeTotal === blueTotal ? null : orangeTotal > blueTotal ? "orange" : "blue";
  const maxCount = teamed.reduce((m, r) => Math.max(m, r.count), 0);
  const topIds = new Set(teamed.filter((r) => r.count > 0 && r.count === maxCount).map((r) => r.staffId));
  return { teamed, orange, blue, orangeTotal, blueTotal, total, margin, leader, maxCount, topIds };
}

/** Rank a team's rows: most bookings first; ties fall back to name A→Z (the
 * wall's existing tie-break, kept so the order is stable between polls). */
export function rankRows<T extends { count: number; name: string }>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export interface LeadLine {
  kind: "empty" | "tied" | "lead";
  side: Side | null;
  text: string;
}

/** The status line under the VS, e.g. "GREEN LEADS BY 3 BOOKINGS". */
export function leadLine(
  s: { leader: Side | null; margin: number; total: number },
  labels: Record<Side, string>,
): LeadLine {
  if (s.leader === null) {
    return s.total === 0
      ? { kind: "empty", side: null, text: "FIRST BOOKING TAKES THE LEAD" }
      : { kind: "tied", side: null, text: "⚡ GAME TIED" };
  }
  const n = s.margin;
  return {
    kind: "lead",
    side: s.leader,
    text: `${labels[s.leader].toUpperCase()} LEADS BY ${n} BOOKING${n === 1 ? "" : "S"}`,
  };
}

/** The big moment copy when the lead changes hands. */
export function takesLeadLine(side: Side, labels: Record<Side, string>): string {
  return `${labels[side].toUpperCase()} TAKES THE LEAD!`;
}

/** The highest milestone crossed going from `prev` to `next`, or null. */
export function milestoneCrossed(
  prev: number,
  next: number,
  steps: readonly number[] = MILESTONES,
): number | null {
  let hit: number | null = null;
  for (const step of steps) if (prev < step && next >= step) hit = step;
  return hit;
}

export interface CountIncrease {
  staffId: string;
  from: number;
  to: number;
}

/**
 * Reps whose count went UP since the previous poll. Reps not present in
 * `prev` are ignored (a fresh page load seeds silently — the wall must not
 * replay the whole morning's bookings as "+1"s). Drops are ignored too; the
 * shared BookingCelebration already debounces those.
 */
export function countIncreases(
  prev: ReadonlyMap<string, number> | null,
  rows: readonly { staffId: string; count: number }[],
): CountIncrease[] {
  if (!prev) return [];
  const out: CountIncrease[] = [];
  for (const r of rows) {
    const from = prev.get(r.staffId);
    if (from !== undefined && r.count > from) out.push({ staffId: r.staffId, from, to: r.count });
  }
  return out;
}

/** Seconds until the 7 PM final whistle on the Sydney clock (negative once past). */
export function secsUntilGameEnd(now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: SYDNEY_TZ,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? "0");
  let h = get("hour");
  if (h === 24) h = 0; // some engines render midnight as 24
  return GAME_END_HOUR * 3600 - (h * 3600 + get("minute") * 60 + get("second"));
}

/** "10:56:45" (hours unpadded, like a match clock). */
export function formatCountdown(secs: number): string {
  const s = Math.max(0, secs);
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return `${hh}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

export type CountdownPhase = "over" | "final10" | "finalHour" | "normal";

/** Urgency phase: final hour reads slightly urgent, final 10 minutes pulse. */
export function countdownPhase(secs: number): CountdownPhase {
  if (secs <= 0) return "over";
  if (secs <= 10 * 60) return "final10";
  if (secs <= 60 * 60) return "finalHour";
  return "normal";
}

// Escalating "last push" messaging through the closing stretch (most urgent last).
export const FINAL_PUSH_TIERS = [
  { at: 1800, label: "Final 30 minutes", sub: "Last push — every booking counts" },
  { at: 600, label: "Final 10 minutes", sub: "Leave nothing on the table" },
  { at: 300, label: "Final 5 minutes", sub: "Every call counts now" },
  { at: 60, label: "Final minute", sub: "Go go go — finish strong!" },
] as const;

export type PushTier = (typeof FINAL_PUSH_TIERS)[number];

/** The most urgent push tier we're currently inside, or null if outside the window. */
export function pushTier(secs: number): PushTier | null {
  let chosen: PushTier | null = null;
  for (const t of FINAL_PUSH_TIERS) if (secs <= t.at) chosen = t;
  return chosen;
}

const TAGLINES = [
  "Closer. 🔒",
  "Always be booking. 📞",
  "Ice in the veins. 🧊",
  "Brings the heat. 🔥",
  "Phone never stops ringing. ☎️",
  "Built different. 💪",
  "Here to win. 🏆",
  "Lethal on the leads. 🎯",
  "Pure hustle. ⚡",
  "Books in their sleep. 😴",
];

/** Stable per-rep tagline (deterministic hash of their id — same every show). */
export function taglineFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return TAGLINES[h % TAGLINES.length] ?? "Here to win. 🏆";
}

/** "over $140,000" — rounds revenue DOWN to a clean figure so it's never a lie. */
export function overMoney(n: number): string {
  let v: number;
  if (n >= 100000) v = Math.floor(n / 10000) * 10000;
  else if (n >= 10000) v = Math.floor(n / 1000) * 1000;
  else v = Math.floor(n / 100) * 100;
  return `$${v.toLocaleString()}`;
}

export interface RosterCard {
  staffId: string;
  name: string;
  team: Side;
  month: number;
  revenue: number | null;
}

/** Build the roll-call: every rep on a team, with this month's count + revenue
 * (from the monthly board), underdogs first so it crescendos to the top earner. */
export function buildRoster(
  daily: readonly ScoreRowLike[],
  monthly: readonly (ScoreRowLike & { revenue?: number })[],
): RosterCard[] {
  const byId = new Map<string, RosterCard>();
  for (const r of monthly) {
    if (isSide(r.team)) {
      byId.set(r.staffId, {
        staffId: r.staffId,
        name: r.name,
        team: r.team,
        month: r.count,
        revenue: typeof r.revenue === "number" ? r.revenue : null,
      });
    }
  }
  for (const r of daily) {
    if (isSide(r.team) && !byId.has(r.staffId)) {
      byId.set(r.staffId, { staffId: r.staffId, name: r.name, team: r.team, month: 0, revenue: null });
    }
  }
  return [...byId.values()].sort((a, b) => a.month - b.month || a.name.localeCompare(b.name));
}

/** Attention-grabbing "fun facts" from the live scoreboard — candidate
 * one-liners for the current standings; the caller picks one to flash up. */
export function buildFacts(
  daily: readonly ScoreRowLike[],
  labels: Record<Side, string>,
  topScorerPrize: number,
): string[] {
  const s = scoreState(daily);
  if (s.teamed.length === 0) return [];
  const facts: string[] = [];

  const top = rankRows(s.teamed)[0];
  if (top && top.count > 0) {
    facts.push(`🔥 ${top.name} is leading the whole floor with ${top.count} today — somebody catch them!`);
  }

  // Someone carrying their team (≥40% of a multi-rep team's total).
  for (const side of SIDES) {
    const reps = side === "orange" ? s.orange : s.blue;
    const tot = side === "orange" ? s.orangeTotal : s.blueTotal;
    if (reps.length >= 2 && tot >= 3) {
      const star = rankRows(reps)[0];
      if (star && star.count > 0 && star.count / tot >= 0.4) {
        facts.push(
          `💪 ${star.name} is carrying ${labels[side]} right now — ${star.count} of their ${tot}. Keep pushing, ${labels[side]}!`,
        );
      }
    }
  }

  if (s.total > 0 && s.leader) {
    const trail: Side = s.leader === "orange" ? "blue" : "orange";
    if (s.margin >= 4) {
      facts.push(`${labels[s.leader]} are pulling away — up by ${s.margin}. ${labels[trail]}, time to respond! 🚀`);
    } else {
      facts.push(`👀 Just ${s.margin} in it — ${labels[trail]} are right on ${labels[s.leader]}'s heels.`);
    }
  } else if (s.total > 0) {
    facts.push(`🤝 Dead heat at ${s.orangeTotal}–${s.blueTotal} — the next booking takes the lead!`);
  }

  const ranked = rankRows(s.teamed.filter((r) => r.count > 0));
  const first = ranked[0];
  const second = ranked[1];
  if (first && second && first.count - second.count === 1) {
    facts.push(`🎯 ${second.name} is one booking behind ${first.name} for top scorer — and that $${topScorerPrize}!`);
  }

  if (s.total > 0) facts.push(`📈 ${s.total} bookings on the board today — let's run it up before 7 PM!`);
  return facts;
}
