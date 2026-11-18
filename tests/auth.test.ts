/**
 * Registration, login, sessions and redirects, run through the real server actions with a
 * fake request (cookies + headers). Uses the isolated test database.
 */
import { createHash, randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", async () => (await import("./support/next-request")).headersModule);
vi.mock("next/navigation", async () => (await import("./support/next-request")).navigationModule);
vi.mock("next/cache", async () => (await import("./support/next-request")).cacheModule);

import { Browser, form, run, use } from "./support/next-request";
import { prisma } from "@/lib/db";
import { login, logout, register } from "@/lib/actions/auth";
import { changePassword } from "@/lib/actions/account";
import { getCurrentUser, safeNext, SESSION_COOKIE } from "@/lib/auth";
import { LIMITS } from "@/lib/rate-limit";
import { SIGNUP_CREDITS } from "@/lib/constants";

const PASSWORD = "Velvet-rope-42";
let n = 0;
const uniq = () => `u${Date.now().toString(36).slice(-5)}${n++}`;

function signupForm(username: string, extra: Record<string, string> = {}) {
  return form({ username, email: `${username}@example.test`, displayName: "Test Player", password: PASSWORD, confirm: PASSWORD, adult: "on", ...extra });
}

/** Registers on a fresh browser and returns it, signed in. */
async function signUp(username = uniq()) {
  const b = use(new Browser());
  const r = await run(register({}, signupForm(username)));
  expect(r.redirect).toBe("/wallet?welcome=1");
  return { browser: b, username, user: await prisma.user.findUniqueOrThrow({ where: { username } }) };
}

const hash = (t: string) => createHash("sha256").update(t).digest("hex");

/** Rate-limit buckets live in process memory; tests that are not about limits start clean. */
const clearLimits = () => (globalThis as unknown as { __rcRateLimits?: Map<string, unknown> }).__rcRateLimits?.clear();
beforeEach(clearLimits);

describe("registration", () => {
  it("creates a USER with an Argon2id hash, a funded wallet, a ledger row and audit rows", async () => {
    const { browser, user } = await signUp();
    expect(user.role).toBe("USER");
    expect(user.passwordHash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    expect(user.passwordHash).not.toContain(PASSWORD);

    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId: user.id }, include: { transactions: true } });
    expect(wallet.balance).toBe(SIGNUP_CREDITS);
    expect(wallet.transactions).toHaveLength(1);
    expect(wallet.transactions[0]).toMatchObject({ type: "signup", status: "completed", amount: SIGNUP_CREDITS, balanceAfter: SIGNUP_CREDITS });
    expect(await prisma.auditLog.count({ where: { transactionId: wallet.transactions[0].id } })).toBe(1);

    // Signed in straight away, with a hardened cookie.
    const cookie = browser.cookies.get(SESSION_COOKIE)!;
    expect(cookie.options).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/" });
    expect((await getCurrentUser())?.id).toBe(user.id);
  });

  it("never takes a role, balance or status from the form", async () => {
    const username = uniq();
    use(new Browser());
    await run(register({}, signupForm(username, { role: "ADMIN", balance: "99999999", status: "active", vipPoints: "999999" })));
    const user = await prisma.user.findUniqueOrThrow({ where: { username }, include: { wallet: true } });
    expect(user.role).toBe("USER");
    expect(user.vipPoints).toBe(0);
    expect(user.wallet!.balance).toBe(SIGNUP_CREDITS);
  });

  it("validates every field on the server", async () => {
    use(new Browser());
    const bad: [Record<string, string>, string][] = [
      [{ password: "short1", confirm: "short1" }, "password"],
      [{ password: "nodigitshere", confirm: "nodigitshere" }, "password"],
      [{ confirm: "Different-42" }, "confirm"],
      [{ email: "not-an-email" }, "email"],
      [{ adult: "" }, "adult"],
      [{ username: "ab" }, "username"],
      [{ username: "bad name!" }, "username"],
      [{ username: "admin" }, "username"],
      [{ displayName: "<script>" }, "displayName"],
    ];
    for (const [patch, field] of bad) {
      clearLimits();
      const r = await run(register({}, signupForm(uniq(), patch)));
      expect(r.state?.errors?.[field], JSON.stringify(patch)).toBeTruthy();
    }
    const self = uniq();
    const r = await run(register({}, signupForm(self, { password: `${self}Xy9abc`, confirm: `${self}Xy9abc` })));
    expect(r.state?.errors?.password).toMatch(/username/);
  });

  it("refuses a taken username or email, case-insensitively", async () => {
    const { username } = await signUp();
    use(new Browser());
    const sameName = await run(register({}, signupForm(username.toUpperCase(), { email: `${uniq()}@example.test` })));
    expect(sameName.state?.errors?.username).toMatch(/taken/);
    const sameEmail = await run(register({}, signupForm(uniq(), { email: `${username.toUpperCase()}@EXAMPLE.TEST` })));
    expect(sameEmail.state?.errors?.email).toMatch(/registered/);
  });

  it("creates exactly one account when the same sign-up is submitted in parallel", async () => {
    const username = uniq();
    use(new Browser());
    const results = await Promise.all([1, 2, 3].map(() => run(register({}, signupForm(username)))));
    expect(results.filter((r) => r.redirect).length).toBe(1);
    expect(await prisma.user.count({ where: { username } })).toBe(1);
    const user = await prisma.user.findUniqueOrThrow({ where: { username }, include: { wallet: true } });
    expect(user.wallet!.balance).toBe(SIGNUP_CREDITS);
  });

  it("rate-limits sign-ups, and a forged X-Forwarded-For does not reset the limit", async () => {
    const b = use(new Browser());
    for (let i = 0; i < LIMITS.registerPerIp.limit; i++) {
      b.headers.set("x-forwarded-for", `203.0.113.${i}`);
      expect((await run(register({}, signupForm(uniq())))).redirect).toBeTruthy();
    }
    b.headers.set("x-forwarded-for", "198.51.100.77");
    const blocked = await run(register({}, signupForm(uniq())));
    expect(blocked.state?.errors?.form).toMatch(/Too many attempts/);
  });
});

describe("login", () => {
  it("signs in by username or email, case-insensitively, and honours a safe next", async () => {
    const { username, user } = await signUp();
    for (const identifier of [username, username.toUpperCase(), `${username}@Example.Test`]) {
      use(new Browser());
      const r = await run(login({}, form({ identifier, password: PASSWORD, next: "/wallet/history?page=2" })));
      expect(r.redirect).toBe("/wallet/history?page=2");
      expect((await getCurrentUser())?.id).toBe(user.id);
    }
  });

  it("gives the same message for an unknown account and a wrong password", async () => {
    const { username } = await signUp();
    use(new Browser());
    const wrong = await run(login({}, form({ identifier: username, password: "Wrong-password-1" })));
    const unknown = await run(login({}, form({ identifier: `nobody_${uniq()}`, password: "Wrong-password-1" })));
    expect(wrong.state?.errors?.form).toBe("Incorrect username, email or password.");
    expect(unknown.state?.errors?.form).toBe(wrong.state?.errors?.form);
    expect(await getCurrentUser()).toBeNull();
  });

  it("locks an account after repeated failures, even when username and email alternate", async () => {
    const { username } = await signUp();
    const b = use(new Browser());
    for (let i = 0; i < LIMITS.loginPerAccount.limit; i++) {
      b.headers.set("x-forwarded-for", `192.0.2.${i}`); // forged IPs make no difference
      const identifier = i % 2 ? username : `${username}@example.test`;
      expect((await run(login({}, form({ identifier, password: `Wrong-pass-${i}` })))).state?.errors?.form).toMatch(/Incorrect/);
    }
    const r = await run(login({}, form({ identifier: username, password: PASSWORD })));
    expect(r.state?.errors?.form).toMatch(/Too many attempts/);
    expect(await getCurrentUser()).toBeNull();
  });

  it("does not let a forged X-Forwarded-For bypass the per-IP limit", async () => {
    const b = use(new Browser());
    for (let i = 0; i < LIMITS.loginPerIp.limit; i++) {
      b.headers.set("x-forwarded-for", `198.51.100.${i}`);
      await run(login({}, form({ identifier: `ghost${i}_${uniq()}`, password: "Whatever-123" })));
    }
    b.headers.set("x-forwarded-for", "198.51.100.250");
    const r = await run(login({}, form({ identifier: `ghost_${uniq()}`, password: "Whatever-123" })));
    expect(r.state?.errors?.form).toMatch(/Too many attempts/);
  });

  it("blocks a suspended account, but only reveals it after the correct password", async () => {
    const { username, user } = await signUp();
    await prisma.user.update({ where: { id: user.id }, data: { status: "suspended" } });
    use(new Browser());
    expect((await run(login({}, form({ identifier: username, password: "Wrong-pass-9" })))).state?.errors?.form).toMatch(/Incorrect/);
    expect((await run(login({}, form({ identifier: username, password: PASSWORD })))).state?.errors?.form).toMatch(/suspended/);
    expect(await getCurrentUser()).toBeNull();
  });

  it("never redirects off-site after login", async () => {
    const { username } = await signUp();
    for (const next of ["//evil.example", "/\\evil.example", "/\t/evil.example", "/\n/evil.example", "https://evil.example", "/ /evil.example", "javascript:alert(1)"]) {
      use(new Browser());
      const r = await run(login({}, form({ identifier: username, password: PASSWORD, next })));
      expect(r.redirect, JSON.stringify(next)).toBe("/");
    }
  });

  it("safeNext keeps only same-site paths", () => {
    expect(safeNext("/games/royal-blackjack/play")).toBe("/games/royal-blackjack/play");
    expect(safeNext("/wallet?welcome=1#top")).toBe("/wallet?welcome=1#top");
    for (const bad of ["//x.example", "/\\x.example", "/\t/x.example", "/\r/x.example", "\\x", "x", "", null, 42, `/${"a".repeat(600)}`]) {
      expect(safeNext(bad, "/fallback")).toBe("/fallback");
    }
  });
});

describe("sessions", () => {
  it("stores only a SHA-256 of the token; a tampered or unknown token is ignored", async () => {
    const { browser, user } = await signUp();
    const token = browser.cookie(SESSION_COOKIE)!;
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(await prisma.session.findUnique({ where: { id: token } })).toBeNull();
    expect((await prisma.session.findUniqueOrThrow({ where: { id: hash(token) } })).userId).toBe(user.id);

    browser.cookies.set(SESSION_COOKIE, { name: SESSION_COOKIE, value: `${token.slice(0, -1)}${token.endsWith("A") ? "B" : "A"}`, options: {} });
    expect(await getCurrentUser()).toBeNull();
    browser.cookies.set(SESSION_COOKIE, { name: SESSION_COOKIE, value: hash(token), options: {} }); // the stored id is not a valid cookie
    expect(await getCurrentUser()).toBeNull();
  });

  it("rejects and deletes an expired session", async () => {
    const { browser } = await signUp();
    const id = hash(browser.cookie(SESSION_COOKIE)!);
    await prisma.session.update({ where: { id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await getCurrentUser()).toBeNull();
    expect(await prisma.session.findUnique({ where: { id } })).toBeNull();
  });

  it("logout deletes the session on the server, not just the cookie", async () => {
    const { browser } = await signUp();
    const token = browser.cookie(SESSION_COOKIE)!;
    expect((await run(logout())).redirect).toBe("/");
    expect(browser.cookie(SESSION_COOKIE)).toBeUndefined();
    expect(await prisma.session.findUnique({ where: { id: hash(token) } })).toBeNull();
    // Replaying the old cookie does nothing.
    browser.cookies.set(SESSION_COOKIE, { name: SESSION_COOKIE, value: token, options: {} });
    expect(await getCurrentUser()).toBeNull();
  });

  it("issues a fresh token at login and revokes one planted beforehand (session fixation)", async () => {
    const victim = await signUp();
    const attacker = await signUp();
    const planted = attacker.browser.cookie(SESSION_COOKIE)!;

    // The victim's browser carries the attacker's token, then the victim logs in.
    const b = use(new Browser());
    b.cookies.set(SESSION_COOKIE, { name: SESSION_COOKIE, value: planted, options: {} });
    await run(login({}, form({ identifier: victim.username, password: PASSWORD })));
    expect(b.cookie(SESSION_COOKIE)).not.toBe(planted);
    expect((await getCurrentUser())?.id).toBe(victim.user.id);
    expect(await prisma.session.findUnique({ where: { id: hash(planted) } })).toBeNull();
  });

  it("a password change signs out every other device and keeps this one", async () => {
    const { browser: laptop, username, user } = await signUp();
    const phone = use(new Browser());
    await run(login({}, form({ identifier: username, password: PASSWORD })));
    const phoneToken = phone.cookie(SESSION_COOKIE)!;
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(2);

    use(laptop);
    const wrong = await run(changePassword({}, form({ current: "Not-my-pass-1", password: "Brand-new-77x", confirm: "Brand-new-77x" })));
    expect(wrong.state?.errors?.current).toBeTruthy();
    const ok = await run(changePassword({}, form({ current: PASSWORD, password: "Brand-new-77x", confirm: "Brand-new-77x" })));
    expect(ok.state?.message).toMatch(/Password changed/);
    expect((await getCurrentUser())?.id).toBe(user.id);

    use(phone);
    expect(phone.cookie(SESSION_COOKIE)).toBe(phoneToken);
    expect(await getCurrentUser()).toBeNull();
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(1);

    use(new Browser());
    expect((await run(login({}, form({ identifier: username, password: PASSWORD })))).state?.errors?.form).toMatch(/Incorrect/);
    expect((await run(login({}, form({ identifier: username, password: "Brand-new-77x" })))).redirect).toBe("/");
  });

  it("an account suspended while signed in loses access on the next request", async () => {
    const { user } = await signUp();
    expect((await getCurrentUser())?.id).toBe(user.id);
    await prisma.user.update({ where: { id: user.id }, data: { status: "suspended" } });
    expect(await getCurrentUser()).toBeNull();
  });

  it("server-side session tokens are random, never reused across logins", async () => {
    const { username } = await signUp();
    const tokens = new Set<string>();
    for (let i = 0; i < 4; i++) {
      const b = use(new Browser());
      await run(login({}, form({ identifier: username, password: PASSWORD, requestId: randomUUID() })));
      tokens.add(b.cookie(SESSION_COOKIE)!);
    }
    expect(tokens.size).toBe(4);
  });
});
