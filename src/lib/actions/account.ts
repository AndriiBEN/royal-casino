"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "../db";
import { createSession, getCurrentUser, requireUser, revokeOtherSessions, touchSession } from "../auth";
import { hashPassword, verifyPassword } from "../password";
import { hit, LIMITS, retryMessage } from "../rate-limit";
import { avatarSchema, fieldErrors, passwordChangeSchema, profileSchema, toggleFavoriteSchema } from "../validations";
import { AVATARS } from "../avatars";
import { getVipTiers } from "../queries";
import { getTierProgress } from "../vip";
import type { FormState } from "./types";

/* ------------------------------------------------------------------ */
/* Profile                                                             */
/* ------------------------------------------------------------------ */

export async function updateProfile(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("/profile");
  const raw = Object.fromEntries(formData) as Record<string, string>;
  const parsed = profileSchema.safeParse(raw);
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: { displayName: parsed.data.displayName, email: parsed.data.email },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { errors: { email: "That email is already registered." } };
    }
    throw e;
  }

  await touchSession();
  revalidatePath("/", "layout");
  return { message: "Profile saved." };
}

/**
 * Requires the current password. On success, every other session is revoked and this
 * browser gets a fresh session, so a stolen cookie stops working.
 */
export async function changePassword(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("/profile");

  const limit = hit(`pwchange:${user.id}`, LIMITS.passwordChangePerUser);
  if (!limit.ok) return { errors: { form: retryMessage(limit.retryAfterMs) } };

  const parsed = passwordChangeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const record = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { passwordHash: true, username: true } });
  if (!record.passwordHash || !(await verifyPassword(record.passwordHash, parsed.data.current))) {
    return { errors: { current: "Current password is incorrect." } };
  }
  if (parsed.data.password.toLowerCase().includes(record.username)) {
    return { errors: { password: "Password must not contain your username." } };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(parsed.data.password), passwordChangedAt: new Date() },
  });
  await prisma.session.deleteMany({ where: { userId: user.id } });
  await createSession(user.id);
  revalidatePath("/", "layout");
  return { message: "Password changed. All other devices have been signed out." };
}

export async function signOutOtherDevices(): Promise<FormState> {
  const user = await requireUser("/profile");
  const count = await revokeOtherSessions(user.id);
  revalidatePath("/profile");
  return { message: count ? `Signed out ${count} other session${count === 1 ? "" : "s"}.` : "No other sessions were active." };
}

/* ------------------------------------------------------------------ */
/* Avatar & privacy                                                    */
/* ------------------------------------------------------------------ */

export async function setAvatar(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("/profile/settings");
  const parsed = avatarSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: { form: "Choose one of the avatars shown." } };
  const preset = AVATARS.find((a) => a.id === parsed.data.avatar)!;
  // Tier-locked avatars are checked here, not just greyed out in the browser.
  const tier = getTierProgress(user.vipPoints, await getVipTiers()).current;
  if (preset.minLevel > tier.level) return { errors: { form: "That avatar unlocks at a higher VIP tier." } };
  await prisma.user.update({ where: { id: user.id }, data: { avatar: preset.id } });
  await touchSession();
  revalidatePath("/", "layout");
  return { message: `Avatar set to ${preset.label}.` };
}

export async function setPrivacy(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("/profile/settings");
  const showOnWinners = formData.get("showOnWinners") === "on";
  await prisma.user.update({ where: { id: user.id }, data: { showOnWinners } });
  revalidatePath("/", "layout");
  return { message: showOnWinners ? "Your wins can appear on the winners board." : "Your wins are hidden from the winners board." };
}

/* ------------------------------------------------------------------ */
/* Favourites                                                          */
/* ------------------------------------------------------------------ */

export type FavoriteResult = { ok: true; favorited: boolean } | { ok: false; error: "auth" | "invalid" };

export async function toggleFavorite(input: { gameId: string }): Promise<FavoriteResult> {
  const parsed = toggleFavoriteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };

  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "auth" };

  const key = { userId_gameId: { userId: user.id, gameId: parsed.data.gameId } };
  const existing = await prisma.favorite.findUnique({ where: key });

  if (existing) {
    await prisma.favorite.delete({ where: key });
  } else {
    const game = await prisma.game.findUnique({ where: { id: parsed.data.gameId }, select: { id: true } });
    if (!game) return { ok: false, error: "invalid" };
    // A double-click can race to create the same favourite; the second one is a no-op.
    await prisma.favorite.upsert({ where: key, create: { userId: user.id, gameId: game.id }, update: {} });
  }

  revalidatePath("/", "layout");
  return { ok: true, favorited: !existing };
}
