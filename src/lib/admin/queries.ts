import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "../db";

/**
 * Read-only data for the admin console. Every caller is behind requireAdmin().
 * Only registered accounts (those with a password) are listed as users; the seeded
 * showcase players cannot sign in and are not managed here.
 */

const DAY = 86_400_000;
const REGISTERED: Prisma.UserWhereInput = { passwordHash: { not: null } };

export async function getDashboard() {
  const now = Date.now();
  const since24 = new Date(now - DAY);
  const since7 = new Date(now - 7 * DAY);
  const since14 = new Date(now - 14 * DAY);

  const [accounts, suspended, admins, newWeek, played24, seen24, played7, seen7, roundsTotal, rounds24, wallets, pending, recentRounds, topGames] = await Promise.all([
    prisma.user.count({ where: REGISTERED }),
    prisma.user.count({ where: { ...REGISTERED, status: "suspended" } }),
    prisma.user.count({ where: { ...REGISTERED, role: "ADMIN" } }),
    prisma.user.count({ where: { ...REGISTERED, createdAt: { gte: since7 } } }),
    prisma.gameRound.groupBy({ by: ["userId"], where: { createdAt: { gte: since24 } } }),
    prisma.session.groupBy({ by: ["userId"], where: { OR: [{ lastSeenAt: { gte: since24 } }, { createdAt: { gte: since24 } }] } }),
    prisma.gameRound.groupBy({ by: ["userId"], where: { createdAt: { gte: since7 } } }),
    prisma.session.groupBy({ by: ["userId"], where: { OR: [{ lastSeenAt: { gte: since7 } }, { createdAt: { gte: since7 } }] } }),
    prisma.gameRound.count({ where: { status: "settled" } }),
    prisma.gameRound.count({ where: { status: "settled", settledAt: { gte: since24 } } }),
    prisma.wallet.aggregate({ _sum: { balance: true } }),
    prisma.transaction.aggregate({ where: { type: "deposit", status: "pending" }, _sum: { amount: true }, _count: true }),
    prisma.gameRound.findMany({ where: { status: "settled", createdAt: { gte: since14 } }, select: { createdAt: true } }),
    prisma.gameRound.groupBy({ by: ["gameId"], where: { status: "settled", createdAt: { gte: since7 } }, _count: { _all: true }, _sum: { staked: true, returned: true }, orderBy: { _count: { gameId: "desc" } }, take: 5 }),
  ]);

  const union = (a: { userId: string }[], b: { userId: string }[]) => new Set([...a, ...b].map((x) => x.userId)).size;

  const days: { date: string; rounds: number }[] = [];
  for (let i = 13; i >= 0; i--) days.push({ date: new Date(now - i * DAY).toISOString().slice(0, 10), rounds: 0 });
  const idx = new Map(days.map((d, i) => [d.date, i]));
  for (const r of recentRounds) {
    const i = idx.get(r.createdAt.toISOString().slice(0, 10));
    if (i !== undefined) days[i].rounds++;
  }

  const gameNames = new Map((await prisma.game.findMany({ where: { id: { in: topGames.map((g) => g.gameId) } }, select: { id: true, name: true, slug: true } })).map((g) => [g.id, g]));

  return {
    accounts,
    suspended,
    admins,
    newWeek,
    active24: union(played24, seen24),
    active7: union(played7, seen7),
    roundsTotal,
    rounds24,
    circulation: wallets._sum.balance ?? 0,
    pendingDeposits: { total: pending._sum.amount ?? 0, count: pending._count },
    days,
    topGames: topGames.map((g) => ({
      name: gameNames.get(g.gameId)?.name ?? "Unknown",
      slug: gameNames.get(g.gameId)?.slug ?? "",
      rounds: g._count._all,
      staked: g._sum.staked ?? 0,
      returned: g._sum.returned ?? 0,
    })),
  };
}

/**
 * Ledger integrity. Every balance change must be a completed ledger row with an audit
 * record, and every wallet balance must equal the sum of its completed ledger rows.
 * Anything non-zero here means a balance moved outside the audited wallet service.
 */
export async function getIntegrity() {
  const [mismatched, unaudited] = await Promise.all([
    prisma.$queryRaw<{ n: bigint }[]>`
      SELECT COUNT(*) AS n FROM "Wallet" w
      WHERE w.balance <> COALESCE((SELECT SUM(t.amount) FROM "Transaction" t WHERE t.walletId = w.id AND t.status = 'completed'), 0)`,
    prisma.$queryRaw<{ n: bigint }[]>`
      SELECT COUNT(*) AS n FROM "Transaction" t
      WHERE t.status = 'completed' AND NOT EXISTS (SELECT 1 FROM "AuditLog" a WHERE a.transactionId = t.id)`,
  ]);
  return { mismatchedWallets: Number(mismatched[0]?.n ?? 0), unauditedEntries: Number(unaudited[0]?.n ?? 0) };
}

/* ------------------------------------------------------------------ */
/* Users                                                               */
/* ------------------------------------------------------------------ */

export type UserFilter = { q?: string; role?: "USER" | "ADMIN"; status?: "active" | "suspended"; page: number; pageSize: number };

export async function listUsers(f: UserFilter) {
  const where: Prisma.UserWhereInput = {
    ...REGISTERED,
    ...(f.role && { role: f.role }),
    ...(f.status && { status: f.status }),
    ...(f.q && { OR: [{ username: { contains: f.q.toLowerCase() } }, { displayName: { contains: f.q } }, { email: { contains: f.q.toLowerCase() } }] }),
  };
  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (f.page - 1) * f.pageSize,
      take: f.pageSize,
      select: {
        id: true,
        username: true,
        displayName: true,
        email: true,
        role: true,
        status: true,
        avatar: true,
        vipPoints: true,
        createdAt: true,
        lastLoginAt: true,
        wallet: { select: { balance: true } },
        _count: { select: { rounds: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);
  return { rows, total, pages: Math.max(1, Math.ceil(total / f.pageSize)) };
}

export async function getUserForAdmin(id: string) {
  return prisma.user.findFirst({
    where: { id, ...REGISTERED },
    select: {
      id: true,
      username: true,
      displayName: true,
      email: true,
      role: true,
      status: true,
      statusReason: true,
      statusChangedAt: true,
      avatar: true,
      vipPoints: true,
      showOnWinners: true,
      createdAt: true,
      lastLoginAt: true,
      passwordChangedAt: true,
      wallet: { select: { id: true, balance: true, bonusStreak: true, lastBonusAt: true } },
      _count: { select: { rounds: true, sessions: true, achievements: true } },
    },
  });
}

/* ------------------------------------------------------------------ */
/* Transactions                                                        */
/* ------------------------------------------------------------------ */

export type TxFilter = { status?: string; type?: string; q?: string; userId?: string; page: number; pageSize: number };

export async function listTransactions(f: TxFilter) {
  const where: Prisma.TransactionWhereInput = {
    ...(f.status && { status: f.status }),
    ...(f.type && { type: f.type }),
    ...(f.userId && { wallet: { userId: f.userId } }),
    ...(f.q && {
      OR: [
        { reference: { contains: f.q.toUpperCase() } },
        { wallet: { user: { username: { contains: f.q.toLowerCase() } } } },
        { wallet: { user: { displayName: { contains: f.q } } } },
      ],
    }),
  };
  const [rows, total, sums] = await Promise.all([
    prisma.transaction.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (f.page - 1) * f.pageSize,
      take: f.pageSize,
      include: { game: { select: { name: true, slug: true } }, wallet: { select: { user: { select: { id: true, username: true, displayName: true, passwordHash: true } } } } },
    }),
    prisma.transaction.count({ where }),
    prisma.transaction.groupBy({ by: ["status"], where: { ...(f.type && { type: f.type }), ...(f.userId && { wallet: { userId: f.userId } }) }, _count: { _all: true } }),
  ]);
  return {
    // Only accounts that can sign in have an admin profile page; demo table players do not.
    // The hash itself never leaves this function.
    rows: rows.map(({ wallet: { user: { passwordHash, ...user } }, ...r }) => ({ ...r, wallet: { user: { ...user, registered: !!passwordHash } } })),
    total,
    pages: Math.max(1, Math.ceil(total / f.pageSize)),
    statusCounts: Object.fromEntries(sums.map((s) => [s.status, s._count._all])) as Record<string, number>,
  };
}

export type AdminTxRow = Awaited<ReturnType<typeof listTransactions>>["rows"][number];

/* ------------------------------------------------------------------ */
/* Audit                                                               */
/* ------------------------------------------------------------------ */

export type AuditFilter = { scope: "admin" | "all"; action?: string; q?: string; userId?: string; page: number; pageSize: number };

export async function listAudit(f: AuditFilter) {
  const where: Prisma.AuditLogWhereInput = {
    ...(f.scope === "admin" && { action: { startsWith: "admin." } }),
    ...(f.action && { action: f.action }),
    ...(f.userId && { OR: [{ targetUserId: f.userId }, { actorId: f.userId }, { wallet: { userId: f.userId } }] }),
    ...(f.q && { OR: [{ actor: { username: { contains: f.q.toLowerCase() } } }, { details: { contains: f.q } }, { action: { contains: f.q } }] }),
  };
  const [rows, total, actions] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (f.page - 1) * f.pageSize,
      take: f.pageSize,
      include: { actor: { select: { username: true, role: true } }, wallet: { select: { user: { select: { id: true, username: true, passwordHash: true } } } } },
    }),
    prisma.auditLog.count({ where }),
    prisma.auditLog.groupBy({ by: ["action"], where: f.scope === "admin" ? { action: { startsWith: "admin." } } : {}, _count: { _all: true }, orderBy: { action: "asc" } }),
  ]);
  // Resolve target usernames for admin actions that are not tied to a wallet.
  const targetIds = [...new Set(rows.map((r) => r.targetUserId).filter(Boolean) as string[])];
  const targets = new Map(
    (await prisma.user.findMany({ where: { id: { in: targetIds } }, select: { id: true, username: true, passwordHash: true } })).map((u) => [u.id, { username: u.username, registered: !!u.passwordHash }]),
  );
  return {
    rows: rows.map(({ wallet, ...r }) => {
      const t = r.targetUserId ? targets.get(r.targetUserId) : null;
      const walletUser = wallet ? { id: wallet.user.id, username: wallet.user.username } : null;
      return {
        ...r,
        wallet: walletUser ? { user: walletUser } : null,
        targetUsername: r.targetUserId ? t?.username ?? null : walletUser?.username ?? null,
        /** whether the account has an admin profile page to link to */
        targetRegistered: r.targetUserId ? !!t?.registered : !!wallet?.user.passwordHash,
      };
    }),
    total,
    pages: Math.max(1, Math.ceil(total / f.pageSize)),
    actions: actions.map((a) => ({ action: a.action, count: a._count._all })),
  };
}

export type AdminAuditRow = Awaited<ReturnType<typeof listAudit>>["rows"][number];

/* ------------------------------------------------------------------ */
/* Games                                                               */
/* ------------------------------------------------------------------ */

export async function listGamesForAdmin() {
  const since = new Date(Date.now() - 30 * DAY);
  const [games, stats, active] = await Promise.all([
    prisma.game.findMany({ orderBy: [{ engine: "asc" }, { name: "asc" }] }),
    prisma.gameRound.groupBy({ by: ["gameId"], where: { status: "settled", createdAt: { gte: since } }, _count: { _all: true }, _sum: { staked: true, returned: true } }),
    prisma.gameRound.groupBy({ by: ["gameId"], where: { status: "active" }, _count: { _all: true } }),
  ]);
  const s = new Map(stats.map((x) => [x.gameId, x]));
  const a = new Map(active.map((x) => [x.gameId, x._count._all]));
  return games.map((g) => {
    const st = s.get(g.id);
    const staked = st?._sum.staked ?? 0;
    const returned = st?._sum.returned ?? 0;
    return { ...g, rounds30: st?._count._all ?? 0, staked30: staked, returned30: returned, observedRtp: staked ? (returned / staked) * 100 : null, activeRounds: a.get(g.id) ?? 0 };
  });
}

export type AdminGame = Awaited<ReturnType<typeof listGamesForAdmin>>[number];
