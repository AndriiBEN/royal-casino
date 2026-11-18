"use server";

import { revalidatePath } from "next/cache";
import { requireUser, touchSession } from "../auth";
import { hit, LIMITS, retryMessage } from "../rate-limit";
import { depositActionSchema, depositSchema, displayCurrencySchema, fieldErrors } from "../validations";
import { getVipTiers } from "../queries";
import { BONUS_COOLDOWN_MS, bonusFor, getTierProgress, nextStreak } from "../vip";
import { atomic, audit, postEntry, requestContext, WalletError, walletErrorMessage } from "../wallet/service";
import { cancelDemoDeposit, confirmDemoDeposit, createDemoDeposit } from "../wallet/transactions";
import { formatIn } from "../wallet/currencies";
import type { FormState } from "./types";

/*
 * DEMO wallet actions. Every action:
 * - re-authenticates from the session cookie (never trusts a user id from the form),
 * - takes only an amount/currency/id from the browser, validated with Zod,
 * - leaves all balance arithmetic to the wallet service on the server.
 */

function fail(e: unknown): FormState {
  if (e instanceof WalletError) return { errors: { form: walletErrorMessage(e) } };
  throw e;
}

function refresh() {
  revalidatePath("/", "layout");
}

/* ------------------------------------------------------------------ */
/* Demo deposits                                                       */
/* ------------------------------------------------------------------ */

export type DepositState = FormState & { reference?: string };

export async function createDeposit(_: DepositState, formData: FormData): Promise<DepositState> {
  const user = await requireUser("/wallet/deposit");
  if (!user.wallet) return { errors: { form: "No wallet found for this account." } };

  const raw = Object.fromEntries(formData) as Record<string, string>;
  const values = { currency: String(raw.currency ?? "").slice(0, 8), credits: String(raw.credits ?? "").slice(0, 12) };

  const parsed = depositSchema.safeParse(raw);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };

  const limit = hit(`deposit:${user.id}`, LIMITS.depositPerUser);
  if (!limit.ok) return { errors: { form: retryMessage(limit.retryAfterMs) }, values };

  try {
    const { tx, duplicate } = await createDemoDeposit({
      walletId: user.wallet.id,
      currency: parsed.data.currency,
      cents: parsed.data.credits * 100,
      idempotencyKey: parsed.data.requestId,
      ctx: await requestContext(user.id),
    });
    await touchSession();
    refresh();
    return {
      reference: tx.reference ?? undefined,
      message: duplicate
        ? `Demo deposit ${tx.reference} was already created. No duplicate was made.`
        : `Demo deposit ${tx.reference} created. Simulate the confirmation below.`,
    };
  } catch (e) {
    return { ...fail(e), values };
  }
}

export async function confirmDeposit(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("/wallet/deposit");
  if (!user.wallet) return { errors: { form: "No wallet found for this account." } };
  const parsed = depositActionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: { form: "Invalid request." } };

  const limit = hit(`wallet:${user.id}`, LIMITS.walletActionPerUser);
  if (!limit.ok) return { errors: { form: retryMessage(limit.retryAfterMs) } };

  try {
    const { tx, alreadyDone } = await confirmDemoDeposit({
      walletId: user.wallet.id,
      transactionId: parsed.data.transactionId,
      ctx: await requestContext(user.id),
    });
    refresh();
    return { message: alreadyDone ? "Already confirmed. Nothing was credited twice." : `${formatIn(tx.amount, "CREDITS")} demo credits added.` };
  } catch (e) {
    refresh();
    return fail(e);
  }
}

export async function cancelDeposit(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("/wallet/deposit");
  if (!user.wallet) return { errors: { form: "No wallet found for this account." } };
  const parsed = depositActionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: { form: "Invalid request." } };

  const limit = hit(`wallet:${user.id}`, LIMITS.walletActionPerUser);
  if (!limit.ok) return { errors: { form: retryMessage(limit.retryAfterMs) } };

  try {
    await cancelDemoDeposit({ walletId: user.wallet.id, transactionId: parsed.data.transactionId, ctx: await requestContext(user.id) });
    refresh();
    return { message: "Demo deposit cancelled." };
  } catch (e) {
    return fail(e);
  }
}

/* ------------------------------------------------------------------ */
/* Display currency                                                    */
/* ------------------------------------------------------------------ */

export async function setDisplayCurrency(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("/wallet");
  if (!user.wallet) return { errors: { form: "No wallet found for this account." } };
  const parsed = displayCurrencySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: { form: "Unknown currency." } };
  const walletId = user.wallet.id;
  const from = user.wallet.displayCurrency;
  if (from === parsed.data.currency) return {};

  const ctx = await requestContext(user.id);
  await atomic(async (db) => {
    await db.wallet.update({ where: { id: walletId }, data: { displayCurrency: parsed.data.currency } });
    await audit(db, { action: "wallet.display_currency", ctx, walletId, details: { from, to: parsed.data.currency } });
  });
  refresh();
  return { message: `Showing balances in ${parsed.data.currency === "CREDITS" ? "credits" : `demo ${parsed.data.currency}`}.` };
}

/* ------------------------------------------------------------------ */
/* Daily bonus                                                         */
/* ------------------------------------------------------------------ */

export async function claimDailyBonus(): Promise<FormState> {
  const user = await requireUser("/wallet");
  if (!user.wallet) return { errors: { form: "No wallet found for this account." } };
  const walletId = user.wallet.id;
  const ctx = await requestContext(user.id);
  // The tier comes from Crown Points, which only game stakes ever increase.
  const tier = getTierProgress(user.vipPoints, await getVipTiers()).current;

  let paid: { amount: number; day: number } | null;
  try {
    paid = await atomic(async (db) => {
      const w = await db.wallet.findUniqueOrThrow({ where: { id: walletId }, select: { lastBonusAt: true, bonusStreak: true } });
      const now = Date.now();
      if (w.lastBonusAt && now - w.lastBonusAt.getTime() < BONUS_COOLDOWN_MS) return null;
      const day = nextStreak(w.lastBonusAt, w.bonusStreak, now);
      const amount = bonusFor(tier.dailyBonus, day);
      // Compare-and-set on the previous claim time: a double-click finds it changed and pays nothing.
      const res = await db.wallet.updateMany({
        where: { id: walletId, lastBonusAt: w.lastBonusAt },
        data: { lastBonusAt: new Date(now), bonusStreak: day },
      });
      if (res.count === 0) return null;
      await postEntry(db, {
        walletId,
        type: "bonus",
        amount,
        note: `Daily demo bonus · ${tier.name} · day ${day}`,
        ctx,
        action: "bonus.claimed",
        details: { tier: tier.name, streakDay: day },
      });
      return { amount, day };
    });
  } catch (e) {
    return fail(e);
  }
  if (!paid) return { errors: { form: "Your daily bonus has already been claimed." } };

  await touchSession();
  refresh();
  return { message: `${formatIn(paid.amount, "CREDITS")} demo credits added · day ${paid.day} streak.` };
}
