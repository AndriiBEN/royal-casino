"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "../db";
import { createSession, destroySession, purgeExpiredSessions, safeNext } from "../auth";
import { burnPasswordCheck, hashPassword, verifyPassword } from "../password";
import { clientIp, hit, LIMITS, reset, retryMessage } from "../rate-limit";
import { fieldErrors, loginSchema, registerSchema } from "../validations";
import { SIGNUP_CREDITS } from "../constants";
import { atomic, openWallet, requestContext } from "../wallet/service";
import type { FormState } from "./types";

const GENERIC_LOGIN_ERROR = "Incorrect username, email or password.";

export async function login(_: FormState, formData: FormData): Promise<FormState> {
  const raw = Object.fromEntries(formData) as Record<string, string>;
  const values = { identifier: String(raw.identifier ?? "").slice(0, 254) };

  const ip = await clientIp();
  const ipLimit = hit(`login:ip:${ip}`, LIMITS.loginPerIp);
  if (!ipLimit.ok) return { errors: { form: retryMessage(ipLimit.retryAfterMs) }, values };

  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };
  const { identifier, password } = parsed.data;

  const user = await prisma.user.findFirst({
    where: identifier.includes("@") ? { email: identifier } : { username: identifier },
    select: { id: true, passwordHash: true, status: true },
  });

  // Per-account limit stops password guessing against one user from many IPs. It is keyed
  // on the account itself, so alternating username and email does not double the attempts.
  const accountKey = `login:acct:${user?.id ?? identifier}`;
  const acctLimit = hit(accountKey, LIMITS.loginPerAccount);
  if (!acctLimit.ok) return { errors: { form: retryMessage(acctLimit.retryAfterMs) }, values };

  const ok = user?.passwordHash ? await verifyPassword(user.passwordHash, password) : await burnPasswordCheck(password);
  if (!user || !ok) return { errors: { form: GENERIC_LOGIN_ERROR }, values };
  // Only revealed after a correct password, so it does not help anyone probe for accounts.
  if (user.status !== "active") return { errors: { form: "This account is suspended. Contact the casino team for help." }, values };

  reset(accountKey);
  await purgeExpiredSessions();
  await createSession(user.id);
  revalidatePath("/", "layout");
  redirect(safeNext(raw.next, "/"));
}

export async function register(_: FormState, formData: FormData): Promise<FormState> {
  const raw = Object.fromEntries(formData) as Record<string, string>;
  const values = {
    username: String(raw.username ?? "").slice(0, 20),
    email: String(raw.email ?? "").slice(0, 254),
    displayName: String(raw.displayName ?? "").slice(0, 32),
    // React resets uncontrolled fields after an action; echo the checkbox so it survives errors.
    adult: raw.adult === "on" ? "on" : "",
  };

  const ip = await clientIp();
  const limit = hit(`register:ip:${ip}`, LIMITS.registerPerIp);
  if (!limit.ok) return { errors: { form: retryMessage(limit.retryAfterMs) }, values };

  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };
  const { username, email, displayName, password } = parsed.data;

  const taken = await prisma.user.findFirst({
    where: { OR: [{ username }, { email }] },
    select: { username: true, email: true },
  });
  if (taken) {
    return {
      errors: taken.username === username ? { username: "That username is taken." } : { email: "That email is already registered." },
      values,
    };
  }

  const passwordHash = await hashPassword(password);
  const ctx = await requestContext(null);
  let userId: string;
  try {
    // User, wallet, opening credits, ledger row and audit rows: all or nothing.
    userId = await atomic(async (db) => {
      const user = await db.user.create({
        data: { username, email, displayName, passwordHash, role: "USER" }, // roles are never taken from user input
        select: { id: true },
      });
      await openWallet(db, user.id, SIGNUP_CREDITS, { ...ctx, actorId: user.id });
      return user.id;
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { errors: { form: "That username or email was just taken. Please try another." }, values };
    }
    throw e;
  }

  await createSession(userId);
  revalidatePath("/", "layout");
  redirect(safeNext(raw.next, "/wallet?welcome=1"));
}

export async function logout() {
  await destroySession();
  revalidatePath("/", "layout");
  redirect("/");
}
