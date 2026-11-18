import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { summarize, type RoundSummary } from "../games/summary";
import { ACHIEVEMENTS, isEarned, type AchievementInput } from "../achievements";
import { liveStreak } from "../vip";

export const ENGINE_LABEL: Record<string, string> = { slots: "Slots", blackjack: "Blackjack", roulette: "Roulette", holdem: "Hold'em" };
export const ENGINES = ["slots", "blackjack", "roulette", "holdem"] as const;

/** Fills in summaries for settled rounds created before summaries existed. */
async function backfillSummaries(userId: string) {
  const missing = await prisma.gameRound.findMany({
    where: { userId, status: "settled", summary: null },
    select: { id: true, engine: true, state: true },
    take: 500,
  });
  for (const r of missing) {
    await prisma.gameRound.update({ where: { id: r.id }, data: { summary: JSON.stringify(summarize(r.engine, JSON.parse(r.state))) } });
  }
}

const parseSummary = (s: string | null): RoundSummary => (s ? (JSON.parse(s) as RoundSummary) : { label: "Round", detail: "", tags: [] });

export type PlayerStats = Awaited<ReturnType<typeof getPlayerStats>>;

/** Everything the profile shows, computed from settled rounds (virtual credits only). */
export async function getPlayerStats(userId: string) {
  await backfillSummaries(userId);
  const rounds = await prisma.gameRound.findMany({
    where: { userId, status: "settled" },
    orderBy: { createdAt: "asc" },
    select: { engine: true, gameId: true, staked: true, returned: true, summary: true, createdAt: true, game: { select: { name: true, slug: true } } },
  });

  const perEngine = Object.fromEntries(ENGINES.map((e) => [e, { rounds: 0, wins: 0, wagered: 0, returned: 0 }])) as Record<
    (typeof ENGINES)[number],
    { rounds: number; wins: number; wagered: number; returned: number }
  >;
  const perGame = new Map<string, { name: string; slug: string; rounds: number }>();
  const tags: Record<string, number> = {};
  let wins = 0;
  let wonAmount = 0;
  let pushes = 0;
  let wagered = 0;
  let returned = 0;
  let bestMultiplier = 0;
  let biggest: { amount: number; game: string; when: Date } | null = null;
  let streak = 0;
  let longestWinStreak = 0;

  const DAYS = 14;
  const dayKey = (d: Date) => d.toISOString().slice(0, 10);
  const today = new Date();
  const days: { date: string; net: number; rounds: number }[] = [];
  for (let i = DAYS - 1; i >= 0; i--) days.push({ date: dayKey(new Date(today.getTime() - i * 86_400_000)), net: 0, rounds: 0 });
  const dayIndex = new Map(days.map((d, i) => [d.date, i]));

  for (const r of rounds) {
    const e = perEngine[r.engine as (typeof ENGINES)[number]];
    const won = r.returned > r.staked;
    if (e) {
      e.rounds++;
      e.wagered += r.staked;
      e.returned += r.returned;
      if (won) e.wins++;
    }
    const g = perGame.get(r.gameId) ?? { name: r.game.name, slug: r.game.slug, rounds: 0 };
    g.rounds++;
    perGame.set(r.gameId, g);

    wagered += r.staked;
    returned += r.returned;
    if (won) {
      wins++;
      wonAmount += r.returned - r.staked;
    } else if (r.returned === r.staked && r.staked > 0) pushes++;
    if (r.staked > 0) bestMultiplier = Math.max(bestMultiplier, r.returned / r.staked);
    if (r.returned - r.staked > (biggest?.amount ?? 0)) biggest = { amount: r.returned - r.staked, game: r.game.name, when: r.createdAt };

    streak = won ? streak + 1 : r.returned === r.staked ? streak : 0;
    longestWinStreak = Math.max(longestWinStreak, streak);

    for (const t of parseSummary(r.summary).tags) tags[t] = (tags[t] ?? 0) + 1;
    const di = dayIndex.get(dayKey(r.createdAt));
    if (di !== undefined) {
      days[di].net += r.returned - r.staked;
      days[di].rounds++;
    }
  }

  const favourite = [...perGame.values()].sort((a, b) => b.rounds - a.rounds)[0] ?? null;
  return {
    rounds: rounds.length,
    wins,
    /** total net virtual credits won across winning rounds */
    wonAmount,
    pushes,
    losses: rounds.length - wins - pushes,
    winRate: rounds.length ? wins / rounds.length : 0,
    wagered,
    returned,
    net: returned - wagered,
    bestMultiplier,
    biggest,
    longestWinStreak,
    favourite,
    perEngine,
    engines: ENGINES.filter((e) => perEngine[e].rounds > 0),
    tags,
    days,
  };
}

/* ------------------------------------------------------------------ */
/* Achievements                                                        */
/* ------------------------------------------------------------------ */

/**
 * Evaluates every badge against the player's recorded activity and stores newly earned
 * ones (insert-only; the first time a badge is seen earned is its unlock date).
 */
export async function syncAchievements(userId: string, stats: PlayerStats, tierLevel: number) {
  const wallet = await prisma.wallet.findUnique({ where: { userId }, select: { id: true, bonusStreak: true, lastBonusAt: true } });
  const bonusClaims = wallet ? await prisma.transaction.count({ where: { walletId: wallet.id, type: "bonus" } }) : 0;
  const input: AchievementInput = {
    rounds: stats.rounds,
    wins: stats.wins,
    bestMultiplier: stats.bestMultiplier,
    engines: stats.engines,
    tags: stats.tags,
    longestWinStreak: stats.longestWinStreak,
    bonusClaims,
    bonusStreak: wallet ? liveStreak(wallet.lastBonusAt, wallet.bonusStreak) : 0,
    tierLevel,
  };

  const have = new Map((await prisma.userAchievement.findMany({ where: { userId } })).map((a) => [a.code, a.unlockedAt]));
  for (const a of ACHIEVEMENTS) {
    if (have.has(a.code) || !isEarned(a, input)) continue;
    try {
      const row = await prisma.userAchievement.create({ data: { userId, code: a.code } });
      have.set(a.code, row.unlockedAt);
    } catch (e) {
      if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e; // a parallel request stored it first
    }
  }

  return ACHIEVEMENTS.map((a) => {
    const [cur, target] = a.progress(input);
    return { code: a.code, title: a.title, description: a.description, icon: a.icon, rarity: a.rarity, current: Math.min(cur, target), target, unlockedAt: have.get(a.code) ?? null };
  });
}

export type AchievementView = Awaited<ReturnType<typeof syncAchievements>>[number];

/* ------------------------------------------------------------------ */
/* Game history                                                        */
/* ------------------------------------------------------------------ */

export async function getGameHistory(userId: string, opts: { engine?: string; page: number; pageSize: number }) {
  await backfillSummaries(userId);
  const where: Prisma.GameRoundWhereInput = { userId, status: "settled", ...(opts.engine && { engine: opts.engine }) };
  const [rows, total] = await Promise.all([
    prisma.gameRound.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (opts.page - 1) * opts.pageSize,
      take: opts.pageSize,
      select: { id: true, engine: true, staked: true, returned: true, summary: true, createdAt: true, game: { select: { name: true, slug: true, icon: true, palette: true } } },
    }),
    prisma.gameRound.count({ where }),
  ]);
  return {
    rows: rows.map((r) => ({ ...r, summary: parseSummary(r.summary) })),
    total,
    pages: Math.max(1, Math.ceil(total / opts.pageSize)),
  };
}

export type HistoryEntry = Awaited<ReturnType<typeof getGameHistory>>["rows"][number];
