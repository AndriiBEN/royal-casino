import "server-only";
import { randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { centsToUnits, type DepositCurrency } from "./currencies";
import {
  DEPOSIT_DAILY_CAP,
  DEPOSIT_MAX,
  DEPOSIT_MAX_PENDING,
  DEPOSIT_MIN,
  DEPOSIT_TTL_MS,
  MAX_BALANCE,
  type TxStatus,
  type TxType,
} from "./limits";
import { atomic, audit, credit, isUniqueViolation, newReference, WalletError, type AuditContext } from "./service";

/**
 * Transaction service: demo deposits and ledger reads.
 *
 * A demo deposit is a SIMULATION. It never contacts a blockchain, payment provider or
 * exchange. It creates a "pending" ledger row that does not touch the balance; the player
 * then confirms it (simulating network confirmations), which credits virtual credits
 * through the wallet service in the same atomic step.
 */

const B32 = "ABCDEFGHJKMNPQRSTVWXYZ23456789";

/**
 * Deliberately invalid on every real network: real BTC/ETH/TRON addresses never start with
 * "DEMO-" and never contain hyphens, so no wallet app will accept it as a destination.
 */
function demoAddress(currency: DepositCurrency) {
  const bytes = randomBytes(16);
  let s = "";
  for (const b of bytes) s += B32[b % B32.length];
  return `DEMO-${currency}-${s.match(/.{4}/g)!.join("-")}`;
}

/** Text encoded in the QR code. It is not a payment URI and says so. */
export function demoQrPayload(t: { reference: string | null; demoAddress: string | null; currency: string | null }) {
  return `ROYAL CASINO - DEMO ONLY - NOT A PAYMENT ADDRESS. Do not send real funds. Ref ${t.reference} / ${t.demoAddress}`;
}

/** Marks overdue pending deposits as expired, one audited row each. */
export async function expireStaleDeposits(walletId: string) {
  const now = new Date();
  const stale = await prisma.transaction.findMany({
    where: { walletId, type: "deposit", status: "pending", expiresAt: { lte: now } },
    select: { id: true, amount: true },
  });
  for (const t of stale) {
    await atomic(async (db) => {
      const res = await db.transaction.updateMany({
        where: { id: t.id, status: "pending" },
        data: { status: "expired", completedAt: now, note: "Not confirmed within 30 minutes." },
      });
      if (res.count) await audit(db, { action: "deposit.expired", ctx: { actorId: null, ip: "system" }, walletId, transactionId: t.id, amount: t.amount });
    });
  }
}

export async function createDemoDeposit(input: {
  walletId: string;
  currency: DepositCurrency;
  cents: number;
  idempotencyKey: string;
  ctx: AuditContext;
}) {
  const { walletId, currency, cents, idempotencyKey, ctx } = input;
  if (!Number.isSafeInteger(cents) || cents < DEPOSIT_MIN || cents > DEPOSIT_MAX) {
    throw new WalletError("invalid", "Amount is outside the demo deposit limits.");
  }

  // Replay of the same form submission: hand back the original instead of a second deposit.
  const existing = await prisma.transaction.findUnique({ where: { walletId_idempotencyKey: { walletId, idempotencyKey } } });
  if (existing) return { tx: existing, duplicate: true };

  await expireStaleDeposits(walletId);

  try {
    const tx = await atomic(async (db) => {
      const wallet = await db.wallet.findUnique({ where: { id: walletId }, select: { balance: true } });
      if (!wallet) throw new WalletError("not_found");

      const pending = await db.transaction.findMany({
        where: { walletId, type: "deposit", status: "pending" },
        select: { amount: true },
      });
      if (pending.length >= DEPOSIT_MAX_PENDING) {
        throw new WalletError("state", `You already have ${DEPOSIT_MAX_PENDING} pending demo deposits. Confirm or cancel one first.`);
      }
      const pendingSum = pending.reduce((s, p) => s + p.amount, 0);
      if (wallet.balance + pendingSum + cents > MAX_BALANCE) throw new WalletError("cap");

      const since = new Date(Date.now() - 24 * 60 * 60_000);
      const day = await db.transaction.aggregate({
        where: { walletId, type: "deposit", status: { in: ["pending", "completed"] }, createdAt: { gte: since } },
        _sum: { amount: true },
      });
      const used = day._sum.amount ?? 0;
      if (used + cents > DEPOSIT_DAILY_CAP) {
        const left = Math.max(0, DEPOSIT_DAILY_CAP - used);
        throw new WalletError("state", `Daily demo deposit limit reached. ${(left / 100).toLocaleString("en-US")} credits left for the next 24 hours.`);
      }

      const row = await db.transaction.create({
        data: {
          walletId,
          reference: newReference("DEP"),
          type: "deposit",
          status: "pending",
          amount: cents,
          balanceAfter: null,
          currency,
          cryptoAmount: centsToUnits(cents, currency).replace(/,/g, ""),
          demoAddress: demoAddress(currency),
          idempotencyKey,
          expiresAt: new Date(Date.now() + DEPOSIT_TTL_MS),
          note: "Demo deposit. No real funds.",
        },
      });
      await audit(db, {
        action: "deposit.created",
        ctx,
        walletId,
        transactionId: row.id,
        amount: cents,
        balanceBefore: wallet.balance,
        details: { currency, cryptoAmount: row.cryptoAmount, reference: row.reference },
      });
      return row;
    });
    return { tx, duplicate: false };
  } catch (e) {
    // Two identical submissions racing: the unique key let only one through.
    if (isUniqueViolation(e)) {
      const tx = await prisma.transaction.findUniqueOrThrow({ where: { walletId_idempotencyKey: { walletId, idempotencyKey } } });
      return { tx, duplicate: true };
    }
    throw e;
  }
}

/**
 * Confirms a pending demo deposit and credits the wallet, atomically.
 * Safe to call twice: the status guard lets exactly one call apply it.
 */
export async function confirmDemoDeposit(input: { walletId: string; transactionId: string; ctx: AuditContext }) {
  const { walletId, transactionId, ctx } = input;
  await expireStaleDeposits(walletId);

  try {
    return await atomic(async (db) => {
      const t = await db.transaction.findFirst({ where: { id: transactionId, walletId, type: "deposit" } });
      if (!t) throw new WalletError("not_found", "Deposit not found.");
      if (t.status === "completed") return { tx: t, alreadyDone: true };
      if (t.status !== "pending") throw new WalletError("state", `This deposit is ${t.status} and cannot be confirmed.`);

      // Claim the row first. Only one concurrent request can flip pending -> completed.
      const claim = await db.transaction.updateMany({
        where: { id: t.id, status: "pending" },
        data: { status: "completed", completedAt: new Date() },
      });
      if (claim.count === 0) throw new WalletError("state", "This deposit was already processed.");

      // Credit with the wallet service's ceiling check, onto the existing ledger row.
      const { after: balance } = await credit(db, walletId, t.amount);

      const tx = await db.transaction.update({ where: { id: t.id }, data: { balanceAfter: balance } });
      await audit(db, {
        action: "deposit.confirmed",
        ctx,
        walletId,
        transactionId: t.id,
        amount: t.amount,
        balanceBefore: balance - t.amount,
        balanceAfter: balance,
        details: { currency: t.currency, cryptoAmount: t.cryptoAmount, reference: t.reference },
      });
      return { tx, alreadyDone: false };
    });
  } catch (e) {
    if (e instanceof WalletError && e.code === "cap") {
      // Rolled back above; record the failure so the history explains what happened.
      await atomic(async (db) => {
        const res = await db.transaction.updateMany({
          where: { id: transactionId, walletId, status: "pending" },
          data: { status: "failed", completedAt: new Date(), note: "Failed: would exceed the demo balance maximum." },
        });
        if (res.count) await audit(db, { action: "deposit.failed", ctx, walletId, transactionId, details: { reason: "cap" } });
      });
    }
    throw e;
  }
}

export async function cancelDemoDeposit(input: { walletId: string; transactionId: string; ctx: AuditContext }) {
  const { walletId, transactionId, ctx } = input;
  return atomic(async (db) => {
    const res = await db.transaction.updateMany({
      where: { id: transactionId, walletId, type: "deposit", status: "pending" },
      data: { status: "cancelled", completedAt: new Date(), note: "Cancelled by player." },
    });
    if (res.count === 0) throw new WalletError("state", "Only pending deposits can be cancelled.");
    await audit(db, { action: "deposit.cancelled", ctx, walletId, transactionId });
  });
}

/* ------------------------------------------------------------------ */
/* Reads                                                               */
/* ------------------------------------------------------------------ */

export async function getPendingDeposits(walletId: string) {
  return prisma.transaction.findMany({
    where: { walletId, type: "deposit", status: "pending" },
    orderBy: { createdAt: "desc" },
  });
}

export type HistoryFilter = { type?: TxType; status?: TxStatus; page: number; pageSize: number };

export async function getHistory(walletId: string, f: HistoryFilter) {
  const where: Prisma.TransactionWhereInput = { walletId, ...(f.type && { type: f.type }), ...(f.status && { status: f.status }) };
  const [rows, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (f.page - 1) * f.pageSize,
      take: f.pageSize,
      include: { game: { select: { name: true, slug: true } } },
    }),
    prisma.transaction.count({ where }),
  ]);
  return { rows, total, pages: Math.max(1, Math.ceil(total / f.pageSize)) };
}

export type HistoryRow = Awaited<ReturnType<typeof getHistory>>["rows"][number];

export async function getRecentTransactions(walletId: string, take = 8) {
  return prisma.transaction.findMany({
    where: { walletId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take,
    include: { game: { select: { name: true, slug: true } } },
  });
}

/** Audit events for one wallet, or across all wallets when `walletId` is null (admin only). */
export async function getAuditTrail(walletId: string | null, take = 30) {
  return prisma.auditLog.findMany({
    where: walletId ? { walletId } : {},
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take,
    include: {
      actor: { select: { username: true, role: true } },
      wallet: { select: { user: { select: { username: true } } } },
    },
  });
}

export type AuditRow = Awaited<ReturnType<typeof getAuditTrail>>[number];

export async function getWalletSummary(walletId: string) {
  const since = new Date(Date.now() - 24 * 60 * 60_000);
  const [deposited, pending, day] = await Promise.all([
    prisma.transaction.aggregate({ where: { walletId, type: "deposit", status: "completed" }, _sum: { amount: true }, _count: true }),
    prisma.transaction.aggregate({ where: { walletId, type: "deposit", status: "pending" }, _sum: { amount: true }, _count: true }),
    prisma.transaction.aggregate({
      where: { walletId, type: "deposit", status: { in: ["pending", "completed"] }, createdAt: { gte: since } },
      _sum: { amount: true },
    }),
  ]);
  return {
    depositedTotal: deposited._sum.amount ?? 0,
    depositCount: deposited._count,
    pendingTotal: pending._sum.amount ?? 0,
    pendingCount: pending._count,
    depositedToday: day._sum.amount ?? 0,
  };
}

/** Recomputes the balance from completed ledger rows. Used by the integrity check. */
export async function ledgerBalance(walletId: string) {
  const agg = await prisma.transaction.aggregate({ where: { walletId, status: "completed" }, _sum: { amount: true } });
  return agg._sum.amount ?? 0;
}
