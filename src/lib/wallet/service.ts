import "server-only";
import { randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { clientIp } from "../client-ip";
import { MAX_BALANCE, MAX_ENTRY, type TxType } from "./limits";

/**
 * Wallet service. The ONLY module that changes Wallet.balance.
 *
 * Rules every caller gets for free:
 * - Amounts are validated integers in credit cents; the browser never supplies a balance.
 * - The balance change, the ledger row and the audit row are written in one database
 *   transaction, so either all three happen or none do.
 * - Debits use a conditional update (`balance >= amount`) and credits a ceiling check
 *   (`balance <= MAX - amount`), so concurrent requests cannot overdraw or overflow.
 * - An idempotency key, when given, is unique per wallet: replaying a request returns
 *   a duplicate error instead of moving money twice.
 */

export type Db = Prisma.TransactionClient;

export type WalletErrorCode = "funds" | "cap" | "invalid" | "not_found" | "duplicate" | "state";

export class WalletError extends Error {
  constructor(
    public code: WalletErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "WalletError";
  }
}

export type AuditContext = { actorId: string | null; ip?: string | null; userAgent?: string | null };

/** Reads IP and user agent from the current request for the audit trail. */
export async function requestContext(actorId: string | null): Promise<AuditContext> {
  const h = await headers();
  return { actorId, ip: await clientIp(), userAgent: h.get("user-agent")?.slice(0, 200) ?? null };
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

export function assertAmount(cents: number) {
  if (!Number.isSafeInteger(cents) || cents <= 0 || cents > MAX_ENTRY) {
    throw new WalletError("invalid", "Amount must be a positive whole number of cents within limits.");
  }
}

/** Public reference such as RC-7K2M9QX4TB (Crockford base32, no ambiguous characters). */
const B32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export function newReference(prefix = "RC") {
  const bytes = randomBytes(10);
  let out = "";
  for (const b of bytes) out += B32[b & 31];
  return `${prefix}-${out}`;
}

export function isUniqueViolation(e: unknown) {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

/* ------------------------------------------------------------------ */
/* Balance primitives (call inside a transaction)                      */
/* ------------------------------------------------------------------ */

async function missingOr(db: Db, walletId: string, code: WalletErrorCode): Promise<never> {
  const exists = await db.wallet.count({ where: { id: walletId } });
  throw new WalletError(exists ? code : "not_found");
}

/** Adds `cents`. Fails with "cap" instead of exceeding MAX_BALANCE. */
export async function credit(db: Db, walletId: string, cents: number) {
  assertAmount(cents);
  const res = await db.wallet.updateMany({
    where: { id: walletId, balance: { lte: MAX_BALANCE - cents } },
    data: { balance: { increment: cents } },
  });
  if (res.count === 0) await missingOr(db, walletId, "cap");
  const { balance } = await db.wallet.findUniqueOrThrow({ where: { id: walletId }, select: { balance: true } });
  return { before: balance - cents, after: balance };
}

/** Removes `cents`. Fails with "funds" instead of going negative. */
export async function debit(db: Db, walletId: string, cents: number) {
  assertAmount(cents);
  const res = await db.wallet.updateMany({
    where: { id: walletId, balance: { gte: cents } },
    data: { balance: { decrement: cents } },
  });
  if (res.count === 0) await missingOr(db, walletId, "funds");
  const { balance } = await db.wallet.findUniqueOrThrow({ where: { id: walletId }, select: { balance: true } });
  return { before: balance + cents, after: balance };
}

/* ------------------------------------------------------------------ */
/* Audit                                                               */
/* ------------------------------------------------------------------ */

export async function audit(
  db: Db,
  entry: {
    action: string;
    ctx: AuditContext;
    walletId?: string | null;
    /** the account an admin action concerns */
    targetUserId?: string | null;
    transactionId?: string | null;
    amount?: number | null;
    balanceBefore?: number | null;
    balanceAfter?: number | null;
    details?: Record<string, unknown>;
  },
) {
  await db.auditLog.create({
    data: {
      action: entry.action,
      actorId: entry.ctx.actorId,
      ip: entry.ctx.ip ?? null,
      userAgent: entry.ctx.userAgent ?? null,
      walletId: entry.walletId ?? null,
      targetUserId: entry.targetUserId ?? null,
      transactionId: entry.transactionId ?? null,
      amount: entry.amount ?? null,
      balanceBefore: entry.balanceBefore ?? null,
      balanceAfter: entry.balanceAfter ?? null,
      details: entry.details ? JSON.stringify(entry.details) : null,
    },
  });
}

/* ------------------------------------------------------------------ */
/* Ledger entry                                                        */
/* ------------------------------------------------------------------ */

export type EntryInput = {
  walletId: string;
  type: TxType;
  /** signed cents: positive credits, negative debits */
  amount: number;
  ctx: AuditContext;
  /** audit action name; defaults to `wallet.<type>` */
  action?: string;
  gameId?: string | null;
  multiplier?: number | null;
  note?: string | null;
  idempotencyKey?: string | null;
  details?: Record<string, unknown>;
  /** set for admin adjustments: whose wallet this was */
  targetUserId?: string | null;
};

/**
 * Applies one completed balance movement: balance change + ledger row + audit row.
 * Must run inside `prisma.$transaction` so a later failure rolls everything back.
 */
export async function postEntry(db: Db, input: EntryInput) {
  if (input.amount === 0) throw new WalletError("invalid", "Amount cannot be zero.");
  const { before, after } =
    input.amount > 0 ? await credit(db, input.walletId, input.amount) : await debit(db, input.walletId, -input.amount);

  let row;
  try {
    row = await db.transaction.create({
      data: {
        walletId: input.walletId,
        reference: newReference(),
        type: input.type,
        status: "completed",
        amount: input.amount,
        balanceAfter: after,
        gameId: input.gameId ?? null,
        multiplier: input.multiplier ?? null,
        note: input.note ?? null,
        idempotencyKey: input.idempotencyKey ?? null,
        completedAt: new Date(),
      },
    });
  } catch (e) {
    // The balance change above is rolled back with the transaction.
    if (isUniqueViolation(e)) throw new WalletError("duplicate");
    throw e;
  }

  await audit(db, {
    action: input.action ?? `wallet.${input.type}`,
    ctx: input.ctx,
    walletId: input.walletId,
    transactionId: row.id,
    targetUserId: input.targetUserId ?? null,
    amount: input.amount,
    balanceBefore: before,
    balanceAfter: after,
    details: input.details,
  });
  return row;
}

/** Lock/timeout errors where nothing was committed, so running the transaction again is safe. */
function isTransient(e: unknown) {
  if (e instanceof Prisma.PrismaClientKnownRequestError) return ["P1008", "P2024", "P2028", "P2034"].includes(e.code);
  return e instanceof Error && /database is locked|Socket timeout/i.test(e.message);
}

/**
 * Runs `fn` atomically. SQLite serialises writers, so the conditional updates above are
 * race-free. A transaction that hit a transient lock error was rolled back in full, so it
 * is retried (up to 3 attempts); business errors such as WalletError are never retried.
 */
export async function atomic<T>(fn: (db: Db) => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await prisma.$transaction(fn, { maxWait: 10_000, timeout: 10_000 });
    } catch (e) {
      if (attempt >= 3 || !isTransient(e)) throw e;
      await new Promise((r) => setTimeout(r, 25 * attempt + Math.random() * 50));
    }
  }
}

/** Creates a wallet with its opening balance, used at registration. */
export async function openWallet(db: Db, userId: string, openingCents: number, ctx: AuditContext) {
  const wallet = await db.wallet.create({ data: { userId, balance: 0 } });
  await audit(db, { action: "wallet.opened", ctx, walletId: wallet.id, balanceAfter: 0 });
  if (openingCents > 0) {
    await postEntry(db, { walletId: wallet.id, type: "signup", amount: openingCents, ctx, action: "wallet.signup_credits" });
  }
  return wallet;
}

/** Fresh read of the authoritative balance. */
export async function getBalance(walletId: string) {
  const w = await prisma.wallet.findUnique({ where: { id: walletId }, select: { balance: true } });
  return w?.balance ?? 0;
}

export function walletErrorMessage(e: WalletError) {
  switch (e.code) {
    case "funds":
      return "Insufficient balance.";
    case "cap":
      return `That would take your balance above the demo maximum of ${(MAX_BALANCE / 100).toLocaleString("en-US")} credits.`;
    case "duplicate":
      return "This request was already processed.";
    case "not_found":
      return "Wallet not found.";
    case "state":
      return e.message !== "state" ? e.message : "That transaction can no longer be changed.";
    default:
      return e.message !== "invalid" ? e.message : "Invalid amount.";
  }
}
