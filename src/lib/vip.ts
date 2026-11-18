import type { VipTier } from "@prisma/client";

/**
 * VIP rules. Progress comes ONLY from simulated activity: every virtual credit staked in
 * a game earns 1 Crown Point (see applyMoney in src/lib/games/server/rounds.ts). Deposits,
 * bonuses and admin adjustments never award points, and nothing can buy them.
 */

export function getTierProgress(points: number, tiers: VipTier[]) {
  const sorted = [...tiers].sort((a, b) => a.minPoints - b.minPoints);
  let current = sorted[0];
  for (const t of sorted) if (points >= t.minPoints) current = t;
  const next = sorted.find((t) => t.minPoints > points) ?? null;

  const progress = next ? ((points - current.minPoints) / (next.minPoints - current.minPoints)) * 100 : 100;

  return { current, next, progress, pointsToNext: next ? next.minPoints - points : 0 };
}

/** Visual identity per tier level (1 Bronze ... 5 Diamond). */
export const TIER_STYLE: Record<number, { name: string; ring: string; from: string; to: string; text: string }> = {
  1: { name: "Bronze", ring: "#c8834f", from: "#e0a273", to: "#8a4f26", text: "#f1c7a4" },
  2: { name: "Silver", ring: "#c9ced6", from: "#eef1f5", to: "#8c939e", text: "#e6e9ee" },
  3: { name: "Gold", ring: "#D4AF62", from: "#f3d98f", to: "#a07a2e", text: "#f1d68c" },
  4: { name: "Platinum", ring: "#a8dbe6", from: "#e2f6fa", to: "#6fa6b5", text: "#cdeef5" },
  5: { name: "Diamond", ring: "#b9f2ff", from: "#ffffff", to: "#6ec8f0", text: "#d8f7ff" },
};

export const tierStyle = (level: number) => TIER_STYLE[level] ?? TIER_STYLE[1];

/* ------------------------------------------------------------------ */
/* Daily demo bonus                                                    */
/* ------------------------------------------------------------------ */

export const BONUS_COOLDOWN_MS = 24 * 60 * 60 * 1000;
/** A claim within this window of the previous one continues the streak. */
export const STREAK_WINDOW_MS = 48 * 60 * 60 * 1000;
/** +10% per consecutive day, up to +50% from day 6. */
export const STREAK_STEP = 10;
export const STREAK_MAX_DAYS = 6;

/** Streak the next claim would have. */
export function nextStreak(lastBonusAt: Date | null, streak: number, now = Date.now()) {
  return lastBonusAt && now - lastBonusAt.getTime() <= STREAK_WINDOW_MS ? streak + 1 : 1;
}

/** Streak still alive right now (0 once a day has been missed). */
export function liveStreak(lastBonusAt: Date | null, streak: number, now = Date.now()) {
  return lastBonusAt && now - lastBonusAt.getTime() <= STREAK_WINDOW_MS ? streak : 0;
}

/** Bonus in cents for a tier base and the streak day being claimed. */
export function bonusFor(base: number, streakDay: number) {
  const pct = 100 + STREAK_STEP * Math.min(Math.max(streakDay, 1) - 1, STREAK_MAX_DAYS - 1);
  return Math.floor((base * pct) / 100);
}
