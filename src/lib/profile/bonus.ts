import "server-only";
import { prisma } from "../db";
import { getVipTiers } from "../queries";
import { BONUS_COOLDOWN_MS, bonusFor, getTierProgress, liveStreak, nextStreak } from "../vip";

export type DailyBonusInfo = {
  tierName: string;
  tierLevel: number;
  /** cents: this tier's base bonus */
  base: number;
  /** streak alive right now (0 if a day was missed) */
  streak: number;
  /** streak day the next claim counts as */
  nextDay: number;
  /** cents the next claim pays */
  amount: number;
  /** epoch ms when the next claim opens, or null if available now */
  availableAt: number | null;
};

/** What the daily demo bonus pays this player next. Pure read; the claim action recomputes it. */
export async function getDailyBonusInfo(userId: string, vipPoints: number): Promise<DailyBonusInfo> {
  const [tiers, wallet] = await Promise.all([
    getVipTiers(),
    prisma.wallet.findUnique({ where: { userId }, select: { lastBonusAt: true, bonusStreak: true } }),
  ]);
  const tier = getTierProgress(vipPoints, tiers).current;
  const last = wallet?.lastBonusAt ?? null;
  const now = Date.now();
  const ready = !last || now - last.getTime() >= BONUS_COOLDOWN_MS;
  const day = nextStreak(last, wallet?.bonusStreak ?? 0, now);
  return {
    tierName: tier.name,
    tierLevel: tier.level,
    base: tier.dailyBonus,
    streak: liveStreak(last, wallet?.bonusStreak ?? 0, now),
    nextDay: day,
    amount: bonusFor(tier.dailyBonus, day),
    availableAt: ready ? null : last!.getTime() + BONUS_COOLDOWN_MS,
  };
}
