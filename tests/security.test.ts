/**
 * Authorization, wallet and game actions through the real server actions and session
 * cookies: who may do what, duplicate and parallel requests, and that no request can move
 * a balance without a ledger row and an audit row. Uses the isolated test database.
 */
import { randomUUID } from "node:crypto";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", async () => (await import("./support/next-request")).headersModule);
vi.mock("next/navigation", async () => (await import("./support/next-request")).navigationModule);
vi.mock("next/cache", async () => (await import("./support/next-request")).cacheModule);

import { Browser, form, run, use } from "./support/next-request";
import { prisma } from "@/lib/db";
import { register } from "@/lib/actions/auth";
import { adjustWallet, revokeUserSessions, setGameEnabled, setUserRole, setUserStatus, updateGame } from "@/lib/actions/admin";
import { cancelDeposit, claimDailyBonus, confirmDeposit, createDeposit } from "@/lib/actions/wallet";
import { dealBlackjack, spinRoulette, spinSlots } from "@/lib/actions/games";
import { toggleFavorite } from "@/lib/actions/account";
import { getCurrentUser } from "@/lib/auth";
import { getIntegrity } from "@/lib/admin/queries";
import { getHistory } from "@/lib/wallet/transactions";
import { SIGNUP_CREDITS } from "@/lib/constants";

const PASSWORD = "Velvet-rope-42";
let n = 0;
const uniq = () => `s${Date.now().toString(36).slice(-5)}${n++}`;
const clearLimits = () => (globalThis as unknown as { __rcRateLimits?: Map<string, unknown> }).__rcRateLimits?.clear();

type Account = { browser: Browser; id: string; walletId: string; username: string };

async function account(role: "USER" | "ADMIN" = "USER"): Promise<Account> {
  clearLimits();
  const username = uniq();
  const browser = use(new Browser());
  const r = await run(register({}, form({ username, email: `${username}@example.test`, displayName: "Sec Test", password: PASSWORD, confirm: PASSWORD, adult: "on" })));
  expect(r.redirect).toBeTruthy();
  const user = await prisma.user.update({ where: { username }, data: { role }, include: { wallet: true } });
  return { browser, id: user.id, walletId: user.wallet!.id, username };
}

const balance = async (walletId: string) => (await prisma.wallet.findUniqueOrThrow({ where: { id: walletId } })).balance;
const ledger = async (walletId: string) =>
  (await prisma.transaction.aggregate({ where: { walletId, status: "completed" }, _sum: { amount: true } }))._sum.amount ?? 0;

const games: Record<string, string> = {};
async function makeGame(engine: string, extra: Record<string, unknown> = {}) {
  const g = await prisma.game.create({
    data: { slug: `sec-${engine}-${uniq()}`, name: `Sec ${engine}`, studio: "T", category: engine === "slots" ? "slots" : "table", tagline: "-", description: "-", rtp: 97, volatility: "low", minBet: 100, maxBet: 100_000, icon: "spade", palette: "obsidian", engine, ...extra },
  });
  return g.id;
}

let admin: Account;
let player: Account;
let other: Account;

beforeAll(async () => {
  await prisma.vipTier.createMany({
    data: [
      { level: 1, name: "Bronze", minPoints: 0, dailyBonus: 1_000_00, perks: "-" },
      { level: 2, name: "Silver", minPoints: 5_000, dailyBonus: 1_500_00, perks: "-" },
    ],
  });
  games.roulette = await makeGame("roulette");
  games.blackjack = await makeGame("blackjack");
  games.slots = await makeGame("slots", { minBet: 20, maxBet: 10_000 });
  admin = await account("ADMIN");
  player = await account();
  other = await account();
});

beforeEach(clearLimits);

/* ------------------------------------------------------------------ */

describe("admin authorization", () => {
  const attempts = (target: Account) => [
    () => setUserRole({}, form({ userId: target.id, role: "ADMIN" })),
    () => setUserStatus({}, form({ userId: target.id, status: "suspended", reason: "testing access" })),
    () => revokeUserSessions({}, form({ userId: target.id })),
    () => adjustWallet({}, form({ userId: target.id, credits: 1_000_000, note: "free money", requestId: randomUUID() })),
    () => updateGame({}, form({ gameId: games.roulette, enabled: "on", minBet: 1, maxBet: 1_000_000 })),
    () => setGameEnabled({}, form({ gameId: games.roulette, enabled: "false" })),
  ];

  it("a signed-out visitor is sent to login by every admin action, and nothing changes", async () => {
    use(new Browser());
    for (const a of attempts(player)) expect((await run(a())).redirect).toMatch(/^\/login\?next=/);
    await expectUntouched();
  });

  it("a USER gets a 404 from every admin action, even with a hand-made request", async () => {
    use(player.browser);
    for (const a of attempts(other)) expect((await run(a())).notFound).toBe(true);
    // Including against themselves: no self-promotion, no self-credit.
    for (const a of attempts(player)) expect((await run(a())).notFound).toBe(true);
    await expectUntouched();
  });

  it("a demoted admin loses access on the very next request", async () => {
    const second = await account("ADMIN");
    use(admin.browser);
    expect((await run(setUserRole({}, form({ userId: second.id, role: "USER" })))).state?.message).toMatch(/now a user/);
    use(second.browser);
    expect(await getCurrentUser()).toBeNull(); // demotion ended their sessions
    expect((await run(setGameEnabled({}, form({ gameId: games.roulette, enabled: "false" })))).redirect).toMatch(/^\/login/);
    expect((await prisma.auditLog.findFirstOrThrow({ where: { action: "admin.role_change", targetUserId: second.id }, orderBy: { createdAt: "desc" } })).actorId).toBe(admin.id);
  });

  it("an admin cannot change their own role, status or wallet", async () => {
    use(admin.browser);
    expect((await run(setUserRole({}, form({ userId: admin.id, role: "USER" })))).state?.errors?.form).toMatch(/own role/);
    expect((await run(setUserStatus({}, form({ userId: admin.id, status: "suspended", reason: "self test" })))).state?.errors?.form).toMatch(/own account/);
    const before = await balance(admin.walletId);
    expect((await run(adjustWallet({}, form({ userId: admin.id, credits: 5_000, note: "self credit", requestId: randomUUID() })))).state?.errors?.form).toMatch(/own wallet/);
    expect(await balance(admin.walletId)).toBe(before);
  });

  it("suspension needs a reason, signs the player out and is audited", async () => {
    const target = await account();
    use(admin.browser);
    expect((await run(setUserStatus({}, form({ userId: target.id, status: "suspended", reason: "" })))).state?.errors?.reason).toBeTruthy();
    expect((await run(setUserStatus({}, form({ userId: target.id, status: "suspended", reason: "Chargeback test" })))).state?.message).toMatch(/suspended/);
    expect(await prisma.session.count({ where: { userId: target.id } })).toBe(0);
    use(target.browser);
    expect(await getCurrentUser()).toBeNull();
    const row = await prisma.auditLog.findFirstOrThrow({ where: { action: "admin.status_change", targetUserId: target.id } });
    expect(JSON.parse(row.details!)).toMatchObject({ from: "active", to: "suspended", reason: "Chargeback test" });
  });

  it("game settings are validated and the published RTP cannot be typed in", async () => {
    use(admin.browser);
    expect((await run(updateGame({}, form({ gameId: games.roulette, minBet: 500, maxBet: 100 })))).state?.errors?.maxBet).toBeTruthy();
    await run(updateGame({}, form({ gameId: games.roulette, enabled: "on", minBet: 1, maxBet: 1000, laPartage: "on", rtp: 250 })));
    const g = await prisma.game.findUniqueOrThrow({ where: { id: games.roulette } });
    expect(g.rtp).toBeLessThan(100);
    expect(JSON.parse(g.config!)).toEqual({ laPartage: true });
    expect(await prisma.auditLog.count({ where: { action: "admin.game_update", actorId: admin.id } })).toBeGreaterThan(0);
  });

  async function expectUntouched() {
    for (const a of [player, other]) {
      const u = await prisma.user.findUniqueOrThrow({ where: { id: a.id }, include: { wallet: true } });
      expect(u.role).toBe("USER");
      expect(u.status).toBe("active");
      expect(u.wallet!.balance).toBe(await ledger(a.walletId));
    }
    expect(await prisma.session.count({ where: { userId: other.id } })).toBeGreaterThan(0);
    expect(await prisma.transaction.count({ where: { type: "adjustment", walletId: { in: [player.walletId, other.walletId] } } })).toBe(0);
    expect((await prisma.game.findUniqueOrThrow({ where: { id: games.roulette } })).enabled).toBe(true);
  }
});

describe("admin wallet adjustments", () => {
  it("are applied once per request id, always with a ledger row and an audit row", async () => {
    const target = await account();
    use(admin.browser);
    const requestId = randomUUID();
    const f = () => form({ userId: target.id, credits: 250, note: "Goodwill credit", requestId });
    const results = await Promise.all([1, 2, 3].map(() => run(adjustWallet({}, f()))));
    expect(results.filter((r) => r.state?.message?.startsWith("Wallet adjusted")).length).toBe(1);
    expect(await balance(target.walletId)).toBe(SIGNUP_CREDITS + 250_00);

    const tx = await prisma.transaction.findFirstOrThrow({ where: { walletId: target.walletId, type: "adjustment" } });
    const a = await prisma.auditLog.findFirstOrThrow({ where: { transactionId: tx.id } });
    expect(a).toMatchObject({ action: "admin.adjustment", actorId: admin.id, targetUserId: target.id, amount: 250_00, balanceBefore: SIGNUP_CREDITS, balanceAfter: SIGNUP_CREDITS + 250_00 });
    expect(JSON.parse(a.details!).reason).toBe("Goodwill credit");
  });

  it("refuse a missing reason, fractions and overdrafts without changing anything", async () => {
    const target = await account();
    use(admin.browser);
    expect((await run(adjustWallet({}, form({ userId: target.id, credits: 100, note: "", requestId: randomUUID() })))).state?.errors?.note).toBeTruthy();
    expect((await run(adjustWallet({}, form({ userId: target.id, credits: 1.5, note: "fraction", requestId: randomUUID() })))).state?.errors?.credits).toBeTruthy();
    expect((await run(adjustWallet({}, form({ userId: target.id, credits: -(SIGNUP_CREDITS / 100 + 1), note: "overdraft", requestId: randomUUID() })))).state?.errors?.credits).toMatch(/below zero/);
    expect(await balance(target.walletId)).toBe(SIGNUP_CREDITS);
  });
});

/* ------------------------------------------------------------------ */

describe("wallet actions", () => {
  async function deposit(a: Account, credits: number, requestId = randomUUID()) {
    use(a.browser);
    const r = await run(createDeposit({}, form({ currency: "USDT", credits, requestId })));
    return { r, tx: await prisma.transaction.findFirst({ where: { walletId: a.walletId, idempotencyKey: requestId } }) };
  }

  it("a deposit form submitted twice creates one pending deposit and does not touch the balance", async () => {
    const a = await account();
    const requestId = randomUUID();
    const [one, two] = await Promise.all([deposit(a, 1_000, requestId), deposit(a, 1_000, requestId)]);
    expect(one.tx?.id).toBe(two.tx?.id);
    expect(await prisma.transaction.count({ where: { walletId: a.walletId, type: "deposit" } })).toBe(1);
    expect(one.tx?.status).toBe("pending");
    expect(await balance(a.walletId)).toBe(SIGNUP_CREDITS);
  });

  it("confirming in parallel credits exactly once", async () => {
    const a = await account();
    const { tx } = await deposit(a, 2_000);
    use(a.browser);
    await Promise.all(Array.from({ length: 6 }, () => run(confirmDeposit({}, form({ transactionId: tx!.id })))));
    expect(await balance(a.walletId)).toBe(SIGNUP_CREDITS + 2_000_00);
    expect(await ledger(a.walletId)).toBe(await balance(a.walletId));
    expect(await prisma.auditLog.count({ where: { transactionId: tx!.id, action: "deposit.confirmed" } })).toBe(1);
  });

  it("one player cannot confirm or cancel another player's deposit", async () => {
    const owner = await account();
    const thief = await account();
    const { tx } = await deposit(owner, 3_000);
    use(thief.browser);
    expect((await run(confirmDeposit({}, form({ transactionId: tx!.id })))).state?.errors?.form).toMatch(/not found/i);
    expect((await run(cancelDeposit({}, form({ transactionId: tx!.id })))).state?.errors?.form).toBeTruthy();
    expect(await balance(thief.walletId)).toBe(SIGNUP_CREDITS);
    expect((await prisma.transaction.findUniqueOrThrow({ where: { id: tx!.id } })).status).toBe("pending");
  });

  it("a cancelled deposit can never be confirmed", async () => {
    const a = await account();
    const { tx } = await deposit(a, 1_500);
    use(a.browser);
    await run(cancelDeposit({}, form({ transactionId: tx!.id })));
    expect((await run(confirmDeposit({}, form({ transactionId: tx!.id })))).state?.errors?.form).toMatch(/cancelled/);
    expect(await balance(a.walletId)).toBe(SIGNUP_CREDITS);
  });

  it("ignores any balance or amount the browser adds, and enforces deposit limits", async () => {
    const a = await account();
    use(a.browser);
    const r = await run(createDeposit({}, form({ currency: "BTC", credits: 50, balance: 999_999_999, amount: 999_999_999, requestId: randomUUID() })));
    expect(r.state?.errors?.credits).toMatch(/Minimum/);
    expect((await run(createDeposit({}, form({ currency: "DOGE", credits: 1_000, requestId: randomUUID() })))).state?.errors?.currency).toBeTruthy();
    expect((await run(createDeposit({}, form({ currency: "ETH", credits: 1_000, requestId: "not-a-uuid" })))).state?.errors?.requestId).toBeTruthy();
    expect(await balance(a.walletId)).toBe(SIGNUP_CREDITS);
  });

  it("a double-clicked daily bonus pays once", async () => {
    const a = await account();
    use(a.browser);
    const results = await Promise.all(Array.from({ length: 5 }, () => run(claimDailyBonus())));
    expect(results.filter((r) => r.state?.message).length).toBe(1);
    expect(await balance(a.walletId)).toBe(SIGNUP_CREDITS + 1_000_00);
    expect(await prisma.transaction.count({ where: { walletId: a.walletId, type: "bonus" } })).toBe(1);
  });

  it("transaction history only ever shows the player's own wallet, filtered by status", async () => {
    const a = await account();
    const { tx } = await deposit(a, 1_000);
    use(a.browser);
    await run(cancelDeposit({}, form({ transactionId: tx!.id })));
    const all = await getHistory(a.walletId, { page: 1, pageSize: 50 });
    expect(all.rows.every((r) => r.walletId === a.walletId)).toBe(true);
    expect(all.rows.map((r) => r.type).sort()).toEqual(["deposit", "signup"]);
    const cancelled = await getHistory(a.walletId, { status: "cancelled", page: 1, pageSize: 50 });
    expect(cancelled.rows.map((r) => r.id)).toEqual([tx!.id]);
  });
});

/* ------------------------------------------------------------------ */

describe("game actions over a real session", () => {
  it("refuse a signed-out request", async () => {
    use(new Browser());
    const r = await spinRoulette({ gameId: games.roulette, bets: [{ kind: "red", amount: 100 }], requestId: randomUUID() });
    expect(r).toMatchObject({ ok: false, error: "auth" });
  });

  it("a request id used at another game is refused, not answered with that game's round", async () => {
    const a = await account();
    use(a.browser);
    const requestId = randomUUID();
    const spun = await spinRoulette({ gameId: games.roulette, bets: [{ kind: "red", amount: 100 }], requestId });
    expect(spun.ok).toBe(true);
    const before = await balance(a.walletId);
    const reused = await dealBlackjack({ gameId: games.blackjack, bet: 100, requestId });
    expect(reused).toMatchObject({ ok: false, error: "invalid" });
    expect(await balance(a.walletId)).toBe(before);
  });

  it("parallel spins with different ids never overdraw and every cent is in the ledger", async () => {
    const a = await account();
    // Leave exactly 3 stakes in the wallet, then fire 12 spins at once.
    use(admin.browser);
    await run(adjustWallet({}, form({ userId: a.id, credits: -(SIGNUP_CREDITS / 100 - 3), note: "set up test", requestId: randomUUID() })));
    expect(await balance(a.walletId)).toBe(300);
    use(a.browser);
    const results = await Promise.all(
      Array.from({ length: 12 }, () => spinSlots({ gameId: games.slots, lineBet: 5, lines: 20, requestId: randomUUID() })),
    );
    const paid = results.filter((r) => r.ok).length;
    const won = (await prisma.transaction.aggregate({ where: { walletId: a.walletId, type: "win" }, _sum: { amount: true } }))._sum.amount ?? 0;
    expect(paid * 100).toBeLessThanOrEqual(300 + won);
    expect(results.filter((r) => !r.ok).every((r) => !r.ok && r.error === "funds")).toBe(true);
    expect(await balance(a.walletId)).toBeGreaterThanOrEqual(0);
    expect(await ledger(a.walletId)).toBe(await balance(a.walletId));
  });

  it("toggling a favourite twice at once never errors", async () => {
    const a = await account();
    use(a.browser);
    const rs = await Promise.all([toggleFavorite({ gameId: games.slots }), toggleFavorite({ gameId: games.slots })]);
    expect(rs.every((r) => r.ok)).toBe(true);
  });
});

describe("ledger integrity after everything above", () => {
  it("every wallet matches its ledger and every completed entry has an audit row", async () => {
    expect(await getIntegrity()).toEqual({ mismatchedWallets: 0, unauditedEntries: 0 });
  });
});
