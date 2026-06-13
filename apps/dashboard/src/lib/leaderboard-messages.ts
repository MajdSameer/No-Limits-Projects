/**
 * Per-cell leaderboard personality. Turns a rep's (count, goal) into a tier
 * and a message. Messages are picked deterministically per rep per day so a
 * cell doesn't flicker between renders, but feels hand-written.
 */

export type CellTier = "zero" | "progress" | "almost" | "hit" | "over" | "wild";

const MESSAGES: Record<CellTier, string[]> = {
  zero: ["Let's get on the board 👀", "First one's the hardest — go get it", "Clean slate ✨"],
  progress: ["Keep it rolling", "Warming up 🔥", "On the move", "Building momentum"],
  almost: ["So close! One more 👏", "Nearly there…", "Smell the target?", "One away — go go go"],
  hit: ["Target smashed! 🎉", "Goal hit — legend 🙌", "Nailed it ✅", "That's the one! 🥳"],
  over: ["On fire 🔥🔥", "Absolute weapon 💪", "Cooking with gas 🍳", "Unstoppable today ⚡"],
  wild: [
    "Slow down lol 😅",
    "Leave some for the rest of us 😏",
    "Save some bookings for everyone else!",
    "OK show-off 😎",
    "Is this even fair anymore? 🐐",
  ],
};

export function cellTier(count: number, goal: number | null): CellTier {
  if (count === 0) return "zero";
  if (goal === null || goal <= 0) return count > 0 ? "progress" : "zero";
  if (count >= goal * 2 || count >= goal + 4) return "wild";
  if (count > goal) return "over";
  if (count === goal) return "hit";
  if (count >= goal - 1) return "almost";
  return "progress";
}

/** Stable per (rep, day) pick from the tier's pool. */
export function cellMessage(staffId: string, dayKey: string, tier: CellTier): string {
  const pool = MESSAGES[tier];
  let hash = 0;
  const seed = `${staffId}:${dayKey}:${tier}`;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return pool[Math.abs(hash) % pool.length] as string;
}

/** One-line greeting for the login welcome. */
export function greeting(name: string, dayKey: string): string {
  const lines = [
    `Welcome back, ${name}! 👋`,
    `Let's get it, ${name} 🚀`,
    `Good to see you, ${name} ☀️`,
    `${name}'s on the floor — game on 🎯`,
    `Big day ahead, ${name} 💪`,
  ];
  let hash = 0;
  const seed = `${name}:${dayKey}`;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return lines[Math.abs(hash) % lines.length] as string;
}
