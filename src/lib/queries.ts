import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { getCurrentUser } from "./auth";
import type { GameFilters } from "./validations";

export async function getFavoriteIds() {
  const user = await getCurrentUser();
  return new Set(user?.favorites.map((f) => f.gameId) ?? []);
}

export async function getGames(filters: GameFilters) {
  // Disabled games are hidden everywhere in the lobby; admins manage them in /admin/games.
  const where: Prisma.GameWhereInput = { enabled: true };
  if (filters.category) where.category = filters.category;
  if (filters.q) {
    where.OR = [{ name: { contains: filters.q } }, { studio: { contains: filters.q } }];
  }
  if (filters.favorites) {
    const user = await getCurrentUser();
    if (!user) return [];
    where.favorites = { some: { userId: user.id } };
  }

  const orderBy: Prisma.GameOrderByWithRelationInput[] =
    filters.sort === "new"
      ? [{ isNew: "desc" }, { createdAt: "desc" }]
      : filters.sort === "rtp"
        ? [{ rtp: "desc" }]
        : filters.sort === "name"
          ? [{ name: "asc" }]
          : [{ players: "desc" }];

  return prisma.game.findMany({ where, orderBy });
}

export async function getFeaturedGames() {
  return prisma.game.findMany({ where: { isFeatured: true, enabled: true }, orderBy: { players: "desc" } });
}

export async function getHotGames(take = 10) {
  return prisma.game.findMany({ where: { isHot: true, enabled: true }, orderBy: { players: "desc" }, take });
}

export async function getNewGames(take = 10) {
  return prisma.game.findMany({ where: { isNew: true, enabled: true }, orderBy: { players: "desc" }, take });
}

export async function getGamesByCategory(category: string, take = 10) {
  return prisma.game.findMany({ where: { category, enabled: true }, orderBy: { players: "desc" }, take });
}

export async function getJackpotGames() {
  return prisma.game.findMany({
    where: { jackpot: { not: null }, enabled: true },
    orderBy: { jackpot: "desc" },
  });
}

export async function getGameBySlug(slug: string) {
  return prisma.game.findUnique({ where: { slug } });
}

export async function getRelatedGames(category: string, excludeId: string, take = 5) {
  return prisma.game.findMany({
    where: { category, enabled: true, NOT: { id: excludeId } },
    orderBy: { players: "desc" },
    take,
  });
}

export async function getCategoryCounts() {
  const rows = await prisma.game.groupBy({ by: ["category"], where: { enabled: true }, _count: { _all: true } });
  return Object.fromEntries(rows.map((r) => [r.category, r._count._all])) as Record<string, number>;
}

export async function getPromotions() {
  return prisma.promotion.findMany({ orderBy: { sortOrder: "asc" } });
}

export async function getVipTiers() {
  return prisma.vipTier.findMany({ orderBy: { level: "asc" } });
}

/** Latest winning rounds across all players, for the "Recent demo winners" feed. */
export async function getRecentWins(take = 12, minAmount = 2_500) {
  return prisma.transaction.findMany({
    // Players who opted out in Account settings never appear on the public board.
    where: { type: "win", amount: { gte: minAmount }, gameId: { not: null }, wallet: { user: { showOnWinners: true } } },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      amount: true,
      multiplier: true,
      createdAt: true,
      wallet: { select: { user: { select: { displayName: true } } } },
      game: { select: { name: true, slug: true, icon: true, palette: true } },
    },
  });
}

export type RecentWin = Awaited<ReturnType<typeof getRecentWins>>[number];

export async function getCasinoStats() {
  const [players, rounds, wagered, paid, biggest, games, rtp] = await Promise.all([
    prisma.user.count(),
    prisma.transaction.count({ where: { type: "bet" } }),
    prisma.transaction.aggregate({ where: { type: "bet" }, _sum: { amount: true } }),
    prisma.transaction.aggregate({ where: { type: "win" }, _sum: { amount: true } }),
    prisma.transaction.findFirst({
      where: { type: "win" },
      orderBy: { amount: "desc" },
      select: { amount: true, game: { select: { name: true } } },
    }),
    prisma.game.count(),
    prisma.game.aggregate({ where: { rtp: { gt: 0 } }, _avg: { rtp: true } }),
  ]);
  return {
    players,
    rounds,
    wagered: Math.abs(wagered._sum.amount ?? 0),
    paidOut: paid._sum.amount ?? 0,
    biggestWin: biggest?.amount ?? 0,
    biggestWinGame: biggest?.game?.name ?? null,
    games,
    averageRtp: rtp._avg.rtp ?? 0,
  };
}

export async function getTransactions(walletId: string, take = 30) {
  return prisma.transaction.findMany({
    where: { walletId },
    orderBy: { createdAt: "desc" },
    take,
    include: { game: { select: { name: true, slug: true } } },
  });
}

export async function getUserStats(walletId: string | undefined) {
  if (!walletId) return { rounds: 0, wagered: 0, won: 0, biggestWin: 0, biggestWinGame: null as string | null };
  const [rounds, wagered, won, biggest] = await Promise.all([
    prisma.transaction.count({ where: { walletId, type: "bet" } }),
    prisma.transaction.aggregate({ where: { walletId, type: "bet" }, _sum: { amount: true } }),
    prisma.transaction.aggregate({ where: { walletId, type: "win" }, _sum: { amount: true } }),
    prisma.transaction.findFirst({
      where: { walletId, type: "win" },
      orderBy: { amount: "desc" },
      include: { game: { select: { name: true } } },
    }),
  ]);
  return {
    rounds,
    wagered: Math.abs(wagered._sum.amount ?? 0),
    won: won._sum.amount ?? 0,
    biggestWin: biggest?.amount ?? 0,
    biggestWinGame: biggest?.game?.name ?? null,
  };
}

/** Active (unexpired) sessions for the profile security panel. */
export async function getActiveSessionCount(userId: string) {
  return prisma.session.count({ where: { userId, expiresAt: { gt: new Date() } } });
}


export async function getFavoriteGames(userId: string) {
  const favs = await prisma.favorite.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { game: true },
  });
  return favs.map((f) => f.game);
}

export async function getLobbyStats() {
  const [agg, count] = await Promise.all([
    prisma.game.aggregate({ _sum: { players: true, jackpot: true } }),
    prisma.game.count(),
  ]);
  return {
    playersOnline: agg._sum.players ?? 0,
    jackpotPool: agg._sum.jackpot ?? 0,
    gameCount: count,
  };
}
