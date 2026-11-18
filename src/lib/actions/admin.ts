"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "../db";
import { requireAdmin } from "../auth";
import { atomic, audit, postEntry, requestContext, WalletError, walletErrorMessage } from "../wallet/service";
import { adminAdjustSchema, adminRoleSchema, fieldErrors } from "../validations";
import { CONFIG_SCHEMAS, publishedRtp, type Engine } from "../games/config";
import type { FormState } from "./types";

/*
 * Admin actions. Rules that hold for every one of them:
 * - requireAdmin() runs first, on the server; hiding UI is never the protection.
 * - Input is validated with Zod.
 * - The change and its audit record are written in one database transaction.
 * - Balances change ONLY through the wallet service (postEntry), which writes a ledger row
 *   and an audit row. There is no other way to alter a balance, and no "silent" mode.
 */

/* ------------------------------------------------------------------ */
/* Users                                                               */
/* ------------------------------------------------------------------ */

export async function setUserRole(_: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const parsed = adminRoleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: { form: "Invalid request." } };
  const { userId, role } = parsed.data;
  if (userId === admin.id) return { errors: { form: "You cannot change your own role." } };

  const target = await prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true, username: true, role: true, status: true } });
  if (!target?.passwordHash) return { errors: { form: "That account cannot sign in, so it cannot hold a role." } };
  if (target.role === role) return { message: `${target.username} is already ${role === "ADMIN" ? "an admin" : "a user"}.` };
  if (role === "ADMIN" && target.status !== "active") return { errors: { form: "Reactivate the account before granting admin." } };

  const ctx = await requestContext(admin.id);
  await atomic(async (db) => {
    await db.user.update({ where: { id: userId }, data: { role } });
    // Demoting someone ends their sessions so the change takes effect immediately.
    if (role === "USER") await db.session.deleteMany({ where: { userId } });
    await audit(db, { action: "admin.role_change", ctx, targetUserId: userId, details: { target: target.username, from: target.role, to: role } });
  });

  revalidatePath("/admin", "layout");
  return { message: `${target.username} is now ${role === "ADMIN" ? "an admin" : "a user"}.` };
}

const statusSchema = z.object({
  userId: z.string().min(1).max(40),
  status: z.enum(["active", "suspended"]),
  reason: z.string().trim().min(3, "Give a short reason (3+ characters).").max(200),
});

export async function setUserStatus(_: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const parsed = statusSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  const { userId, status, reason } = parsed.data;
  if (userId === admin.id) return { errors: { form: "You cannot change your own account status." } };

  const target = await prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true, username: true, role: true, status: true } });
  if (!target?.passwordHash) return { errors: { form: "Account not found." } };
  if (target.role === "ADMIN" && status === "suspended") return { errors: { form: "Remove admin rights before suspending this account." } };
  if (target.status === status) return { message: `${target.username} is already ${status}.` };

  const ctx = await requestContext(admin.id);
  await atomic(async (db) => {
    await db.user.update({ where: { id: userId }, data: { status, statusReason: reason, statusChangedAt: new Date() } });
    // Suspension signs the user out everywhere at once.
    if (status === "suspended") await db.session.deleteMany({ where: { userId } });
    await audit(db, { action: "admin.status_change", ctx, targetUserId: userId, details: { target: target.username, from: target.status, to: status, reason } });
  });

  revalidatePath("/admin", "layout");
  return { message: status === "suspended" ? `${target.username} is suspended and signed out.` : `${target.username} is active again.` };
}

export async function revokeUserSessions(_: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const userId = z.string().min(1).max(40).safeParse(formData.get("userId"));
  if (!userId.success) return { errors: { form: "Invalid request." } };
  if (userId.data === admin.id) return { errors: { form: "Use your profile's security settings for your own sessions." } };
  const target = await prisma.user.findUnique({ where: { id: userId.data }, select: { username: true } });
  if (!target) return { errors: { form: "Account not found." } };

  const ctx = await requestContext(admin.id);
  const count = await atomic(async (db) => {
    const res = await db.session.deleteMany({ where: { userId: userId.data } });
    await audit(db, { action: "admin.sessions_revoked", ctx, targetUserId: userId.data, details: { target: target.username, sessions: res.count } });
    return res.count;
  });
  revalidatePath("/admin", "layout");
  return { message: `Signed ${target.username} out of ${count} session${count === 1 ? "" : "s"}.` };
}

/**
 * The ONLY admin path that changes a balance. It goes through the wallet service, so the
 * adjustment is a ledger row (type "adjustment") with an audit record naming the admin,
 * the reason and the balance before and after. A reason is mandatory.
 */
export async function adjustWallet(_: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const parsed = adminAdjustSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  const { userId, credits, note, requestId } = parsed.data;
  // Like roles and status: an admin never moves credits into or out of their own wallet.
  if (userId === admin.id) return { errors: { form: "You cannot adjust your own wallet. Ask another admin." } };
  const cents = credits * 100;

  const wallet = await prisma.wallet.findUnique({ where: { userId }, select: { id: true, user: { select: { username: true } } } });
  if (!wallet) return { errors: { form: "That user has no wallet." } };

  const ctx = await requestContext(admin.id);
  try {
    await atomic((db) =>
      postEntry(db, {
        walletId: wallet.id,
        type: "adjustment",
        amount: cents,
        note: `${note} (by ${admin.username})`,
        idempotencyKey: requestId,
        ctx,
        action: "admin.adjustment",
        targetUserId: userId,
        details: { target: wallet.user.username, reason: note },
      }),
    );
  } catch (e) {
    if (e instanceof WalletError) {
      if (e.code === "funds") return { errors: { credits: "That would take the balance below zero." } };
      return { errors: { form: walletErrorMessage(e) } };
    }
    throw e;
  }

  revalidatePath("/admin", "layout");
  return { message: `Wallet adjusted by ${credits > 0 ? "+" : ""}${credits.toLocaleString("en-US")} credits.` };
}

/* ------------------------------------------------------------------ */
/* Games                                                               */
/* ------------------------------------------------------------------ */

const creditsField = z.coerce.number({ message: "Enter an amount." }).min(0.01, "At least 0.01 credits.").max(1_000_000, "Too large.");
const checkbox = z.preprocess((v) => v === "on" || v === "true", z.boolean());

const gameSchema = z
  .object({
    gameId: z.string().min(1).max(40),
    enabled: checkbox,
    isFeatured: checkbox,
    isHot: checkbox,
    isNew: checkbox,
    minBet: creditsField,
    maxBet: creditsField,
    note: z.string().trim().max(200).optional().default(""),
    // engine options (only the ones for the game's engine are used)
    payScale: z.coerce.number().int().optional(),
    blackjackPays: z.enum(["3:2", "6:5"]).optional(),
    dealerHitsSoft17: checkbox.optional(),
    laPartage: checkbox.optional(),
    opponents: z.coerce.number().int().optional(),
  })
  .refine((d) => d.minBet <= d.maxBet, { message: "Minimum bet cannot exceed the maximum.", path: ["maxBet"] });

/** Game settings, payout rules and availability. Published RTP is derived, never typed. */
export async function updateGame(_: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const parsed = gameSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  const d = parsed.data;

  const game = await prisma.game.findUnique({ where: { id: d.gameId } });
  if (!game) return { errors: { form: "Game not found." } };
  const engine = game.engine as Engine;

  const minBet = Math.round(d.minBet * 100);
  const maxBet = Math.round(d.maxBet * 100);
  if (engine === "holdem" && minBet % 2) return { errors: { minBet: "Hold'em blinds need an even number of cents (the small blind is half)." } };

  const engineInput =
    engine === "slots"
      ? { payScale: d.payScale }
      : engine === "blackjack"
        ? { blackjackPays: d.blackjackPays, dealerHitsSoft17: d.dealerHitsSoft17 ?? false }
        : engine === "roulette"
          ? { laPartage: d.laPartage ?? false }
          : { opponents: d.opponents };
  const cfg = CONFIG_SCHEMAS[engine].safeParse(engineInput);
  if (!cfg.success) return { errors: { form: cfg.error.issues[0]?.message ?? "Invalid configuration." } };
  const config = JSON.stringify(cfg.data);
  const rtp = publishedRtp(engine, config, game.category === "jackpots" && game.jackpot !== null);

  const next = { enabled: d.enabled, isFeatured: d.isFeatured, isHot: d.isHot, isNew: d.isNew, minBet, maxBet, config, rtp };
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const [k, v] of Object.entries(next)) {
    const before = (game as Record<string, unknown>)[k];
    if (before !== v) changes[k] = { from: before, to: v };
  }
  if (!Object.keys(changes).length) return { message: "No changes to save." };

  const ctx = await requestContext(admin.id);
  await atomic(async (db) => {
    await db.game.update({ where: { id: game.id }, data: next });
    await audit(db, { action: "admin.game_update", ctx, details: { game: game.slug, name: game.name, changes, note: d.note || undefined } });
  });

  revalidatePath("/", "layout");
  return { message: `${game.name} saved (${Object.keys(changes).join(", ")}).` };
}

const toggleSchema = z.object({ gameId: z.string().min(1).max(40), enabled: z.enum(["true", "false"]) });

export async function setGameEnabled(_: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const parsed = toggleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: { form: "Invalid request." } };
  const enabled = parsed.data.enabled === "true";
  const game = await prisma.game.findUnique({ where: { id: parsed.data.gameId }, select: { id: true, slug: true, name: true, enabled: true } });
  if (!game) return { errors: { form: "Game not found." } };
  if (game.enabled === enabled) return {};

  const ctx = await requestContext(admin.id);
  await atomic(async (db) => {
    await db.game.update({ where: { id: game.id }, data: { enabled } });
    await audit(db, { action: "admin.game_update", ctx, details: { game: game.slug, name: game.name, changes: { enabled: { from: game.enabled, to: enabled } } } });
  });
  revalidatePath("/", "layout");
  return { message: `${game.name} ${enabled ? "enabled" : "disabled"}.` };
}
