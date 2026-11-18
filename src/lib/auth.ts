import "server-only";
import { cache } from "react";
import { createHash, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { prisma } from "./db";
import { clientIp } from "./client-ip";

/* ------------------------------------------------------------------
   Cookie
   ------------------------------------------------------------------ */

const SECURE = process.env.NODE_ENV === "production" && process.env.INSECURE_COOKIES !== "1";

/**
 * With HTTPS the "__Host-" prefix makes browsers enforce Secure, Path=/ and no Domain,
 * so the cookie cannot be set or overridden by another subdomain or by plain HTTP.
 */
export const SESSION_COOKIE = SECURE ? "__Host-rc_session" : "rc_session";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** Sessions are extended when used, at most once per this interval. */
const SESSION_TOUCH_MS = 24 * 60 * 60 * 1000;

const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");

async function writeCookie(token: string, expires: Date) {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: SECURE,
    sameSite: "lax",
    path: "/",
    expires,
    priority: "high",
  });
}

/* ------------------------------------------------------------------
   Sessions
   ------------------------------------------------------------------ */

/**
 * Starts a new session. Any session already carried by this browser is revoked first,
 * so a token planted before login can never be promoted (session fixation).
 */
export async function createSession(userId: string) {
  const jar = await cookies();
  const previous = jar.get(SESSION_COOKIE)?.value;
  if (previous) await prisma.session.deleteMany({ where: { id: tokenHash(previous) } });

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const h = await headers();

  await prisma.session.create({
    data: {
      id: tokenHash(token),
      userId,
      expiresAt,
      userAgent: h.get("user-agent")?.slice(0, 255) ?? null,
      ip: await clientIp(),
    },
  });
  await prisma.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });
  await writeCookie(token, expiresAt);
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { id: tokenHash(token) } });
  jar.delete(SESSION_COOKIE);
}

/** Revokes every session of a user except, optionally, the current one. */
export async function revokeOtherSessions(userId: string) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const keep = token ? tokenHash(token) : undefined;
  const res = await prisma.session.deleteMany({ where: { userId, ...(keep ? { NOT: { id: keep } } : {}) } });
  return res.count;
}

/**
 * Extends the current session (sliding expiry). Cookies can only be written from server
 * actions and route handlers, so this is called from authenticated actions, not from pages.
 */
export async function touchSession() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return;
  const id = tokenHash(token);
  const session = await prisma.session.findUnique({ where: { id }, select: { lastSeenAt: true } });
  if (!session || Date.now() - session.lastSeenAt.getTime() < SESSION_TOUCH_MS) return;
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await prisma.session.update({ where: { id }, data: { lastSeenAt: new Date(), expiresAt } });
  await writeCookie(token, expiresAt);
}

/* ------------------------------------------------------------------
   Current user
   ------------------------------------------------------------------ */

const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

/** The signed-in user for this request (with wallet and favourite ids), or null. Cached per request. */
export const getCurrentUser = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || !TOKEN_RE.test(token)) return null;

  const session = await prisma.session.findUnique({
    where: { id: tokenHash(token) },
    include: {
      user: {
        include: {
          wallet: true,
          favorites: { select: { gameId: true } },
        },
      },
    },
  });
  if (!session) return null;
  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  // A password change invalidates sessions created before it.
  const changed = session.user.passwordChangedAt;
  if (changed && session.createdAt < changed) return null;
  if (!session.user.passwordHash) return null;
  // Suspended accounts lose access immediately, even if a session somehow survived.
  if (session.user.status !== "active") return null;

  const { passwordHash: _omit, ...user } = session.user;
  return user;
});

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

/* ------------------------------------------------------------------
   Guards
   ------------------------------------------------------------------ */

/** For pages and actions that need a signed-in user: redirects to /login and comes back afterwards. */
export async function requireUser(next: string) {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}

export function hasRole(user: { role: Role } | null | undefined, role: Role) {
  return user?.role === role;
}

/**
 * Admin-only guard. Signed-out visitors are sent to login. Signed-in non-admins get a 404,
 * so the admin area's existence is not confirmed to them.
 */
export async function requireAdmin(next = "/admin") {
  const user = await requireUser(next);
  if (user.role !== "ADMIN") notFound();
  return user;
}

/**
 * Only allow same-site relative redirects: a single leading "/" followed by printable,
 * non-space ASCII and no backslash. Browsers strip tabs and newlines from URLs and treat
 * "\" as "/", so "/\t/evil.com" or "/\evil.com" would otherwise become "//evil.com".
 */
const SAFE_PATH = /^\/(?![/\\])[\x21-\x5B\x5D-\x7E]*$/;
export function safeNext(next: unknown, fallback = "/") {
  return typeof next === "string" && next.length <= 512 && SAFE_PATH.test(next) ? next : fallback;
}

/** Deletes expired sessions. Cheap enough to run on every login. */
export async function purgeExpiredSessions() {
  await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
}
