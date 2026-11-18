import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bonusFor, getTierProgress, liveStreak, nextStreak, STREAK_WINDOW_MS } from "@/lib/vip";
import { ACHIEVEMENTS, isEarned, type AchievementInput } from "@/lib/achievements";
import { AVATARS, avatarById } from "@/lib/avatars";
import { summarize } from "@/lib/games/summary";
import { deal } from "@/lib/games/blackjack/engine";
import { settle } from "@/lib/games/roulette/engine";
import { seededRng } from "@/lib/games/rng";
import type { Card } from "@/lib/games/cards";
import { prisma } from "@/lib/db";
import { getPlayerStats, syncAchievements } from "@/lib/profile/stats";
import type { VipTier } from "@prisma/client";

const tiers = [
  [1, "Bronze", 0],
  [2, "Silver", 5_000],
  [3, "Gold", 25_000],
  [4, "Platinum", 100_000],
  [5, "Diamond", 500_000],
].map(([level, name, minPoints]) => ({ id: String(level), level, name, minPoints, cashback: 0, dailyBonus: 100_000 * Number(level), perks: "" })) as VipTier[];

describe("VIP tiers", () => {
  it("places points in the right tier with progress to the next", () => {
    expect(getTierProgress(0, tiers).current.name).toBe("Bronze");
    expect(getTierProgress(4_999, tiers).current.name).toBe("Bronze");
    const silver = getTierProgress(15_000, tiers);
    expect(silver.current.name).toBe("Silver");
    expect(silver.next?.name).toBe("Gold");
    expect(silver.progress).toBeCloseTo(50);
    expect(silver.pointsToNext).toBe(10_000);
    const top = getTierProgress(900_000, tiers);
    expect(top.current.name).toBe("Diamond");
    expect(top.next).toBeNull();
    expect(top.progress).toBe(100);
  });
});

describe("daily demo bonus", () => {
  it("adds 10% per consecutive day, capped at +50%", () => {
    expect(bonusFor(100_000, 1)).toBe(100_000);
    expect(bonusFor(100_000, 2)).toBe(110_000);
    expect(bonusFor(100_000, 6)).toBe(150_000);
    expect(bonusFor(100_000, 30)).toBe(150_000);
  });

  it("continues the streak within 48 hours and resets after", () => {
    const now = Date.now();
    expect(nextStreak(null, 0, now)).toBe(1);
    expect(nextStreak(new Date(now - 25 * 3_600_000), 3, now)).toBe(4);
    expect(nextStreak(new Date(now - STREAK_WINDOW_MS - 1), 9, now)).toBe(1);
    expect(liveStreak(new Date(now - 30 * 3_600_000), 5, now)).toBe(5);
    expect(liveStreak(new Date(now - 50 * 3_600_000), 5, now)).toBe(0);
  });
});

describe("avatars", () => {
  it("has unique ids, a free default and higher-tier exclusives", () => {
    expect(new Set(AVATARS.map((a) => a.id)).size).toBe(AVATARS.length);
    expect(avatarById("crown").minLevel).toBe(1);
    expect(avatarById("not-a-real-id").id).toBe("crown");
    for (const level of [2, 3, 4, 5]) expect(AVATARS.some((a) => a.minLevel === level)).toBe(true);
  });
});

const base: AchievementInput = { rounds: 0, wins: 0, bestMultiplier: 0, engines: [], tags: {}, longestWinStreak: 0, bonusClaims: 0, bonusStreak: 0, tierLevel: 1 };
const earned = (s: Partial<AchievementInput>) => ACHIEVEMENTS.filter((a) => isEarned(a, { ...base, ...s })).map((a) => a.code);

describe("achievements", () => {
  it("are all locked for a brand-new player", () => {
    expect(earned({})).toEqual([]);
  });

  it("unlock from recorded activity", () => {
    expect(earned({ rounds: 1 })).toEqual(["first_round"]);
    expect(earned({ rounds: 50 })).toContain("regular");
    expect(earned({ engines: ["slots", "blackjack", "roulette", "holdem"] })).toContain("grand_tour");
    expect(earned({ bestMultiplier: 12 })).toContain("big_win");
    expect(earned({ bestMultiplier: 12 })).not.toContain("royal_win");
    expect(earned({ tags: { natural: 1, straight_hit: 2 } })).toEqual(expect.arrayContaining(["natural", "straight_up"]));
    expect(earned({ bonusStreak: 7, bonusClaims: 7 })).toEqual(expect.arrayContaining(["loyal_week", "early_bird"]));
    expect(earned({ tierLevel: 3 })).toEqual(["silver_circle", "gold_circle"]);
  });

  it("report progress capped at the target", () => {
    const regular = ACHIEVEMENTS.find((a) => a.code === "regular")!;
    expect(regular.progress({ ...base, rounds: 12 })).toEqual([12, 50]);
  });
});

describe("round summaries", () => {
  const shoe = (...c: Card[]) => c.slice().reverse();
  it("tags a natural blackjack", () => {
    const s = summarize("blackjack", deal(seededRng(1), 100, shoe("As", "9h", "Kd", "7c")));
    expect(s).toMatchObject({ label: "Blackjack", tags: ["natural"] });
  });

  it("tags a straight-up roulette hit", () => {
    const s = summarize("roulette", settle(17, [{ kind: "straight", value: 17, amount: 100 }]));
    expect(s.label).toBe("17 black");
    expect(s.tags).toEqual(["straight_hit"]);
  });
});

/* ------------------------------------------------------------------ */
/* Stats + achievements against the database                          */
/* ------------------------------------------------------------------ */

describe("player statistics (database)", () => {
  let userId = "";
  let gameId = "";
  const tag = `v${Date.now().toString(36)}`;

  beforeAll(async () => {
    userId = (await prisma.user.create({ data: { username: `${tag}_vip`, displayName: "VIP Test", wallet: { create: { balance: 0 } } } })).id;
    gameId = (
      await prisma.game.create({
        data: { slug: `${tag}-roulette`, name: "Test Roulette", studio: "T", category: "table", tagline: "-", description: "-", rtp: 97.3, volatility: "low", minBet: 1, maxBet: 1000, icon: "disc", palette: "obsidian", engine: "roulette" },
      })
    ).id;
    // Three rounds: a straight-up win (36x), a loss, a win. One round has no stored summary (backfill path).
    const rounds = [settle(17, [{ kind: "straight", value: 17, amount: 100 }]), settle(0, [{ kind: "red", amount: 100 }]), settle(1, [{ kind: "red", amount: 100 }])];
    for (const [i, r] of rounds.entries()) {
      await prisma.gameRound.create({
        data: {
          userId,
          gameId,
          engine: "roulette",
          status: "settled",
          state: JSON.stringify(r),
          requestId: randomUUID(),
          staked: r.staked,
          returned: r.returned,
          summary: i === 2 ? null : JSON.stringify(summarize("roulette", r)),
        },
      });
    }
  });

  afterAll(async () => {
    await prisma.user.delete({ where: { id: userId } });
    await prisma.game.delete({ where: { id: gameId } });
    await prisma.$disconnect();
  });

  it("computes totals, win rate, best multiplier and daily net", async () => {
    const s = await getPlayerStats(userId);
    expect(s.rounds).toBe(3);
    expect(s.wins).toBe(2);
    expect(s.wagered).toBe(300);
    expect(s.returned).toBe(3600 + 200);
    expect(s.wonAmount).toBe(3500 + 100);
    expect(s.bestMultiplier).toBe(36);
    expect(s.tags.straight_hit).toBe(1);
    expect(s.days.at(-1)!.net).toBe(3800 - 300);
    expect(s.perEngine.roulette.rounds).toBe(3);
    // The missing summary was backfilled.
    expect(await prisma.gameRound.count({ where: { userId, summary: null } })).toBe(0);
  });

  it("stores earned badges once and keeps their unlock date", async () => {
    const s = await getPlayerStats(userId);
    const first = await syncAchievements(userId, s, 1);
    const codes = first.filter((a) => a.unlockedAt).map((a) => a.code).sort();
    expect(codes).toEqual(["big_win", "first_round", "straight_up"]);
    const again = await syncAchievements(userId, s, 1);
    expect(again.filter((a) => a.unlockedAt).map((a) => a.unlockedAt!.getTime())).toEqual(first.filter((a) => a.unlockedAt).map((a) => a.unlockedAt!.getTime()));
    expect(await prisma.userAchievement.count({ where: { userId } })).toBe(3);
  });
});
