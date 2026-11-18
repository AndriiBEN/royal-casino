import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { blackjackRtp, parseConfig, publishedRtp, SLOTS_BASE_RTP } from "@/lib/games/config";
import { act, deal, dealerShouldHit, payoutFor } from "@/lib/games/blackjack/engine";
import { settle } from "@/lib/games/roulette/engine";
import { evaluate, type Grid, type SymbolId } from "@/lib/games/slots/engine";
import { simulateSlots } from "@/lib/games/slots/simulate";
import { seededRng } from "@/lib/games/rng";
import type { Card } from "@/lib/games/cards";
import { prisma } from "@/lib/db";
import { atomic, openWallet } from "@/lib/wallet/service";
import { getIntegrity } from "@/lib/admin/queries";
import { setPlayerForTests } from "@/lib/games/server/context";
import { blackjackAct, blackjackDeal } from "@/lib/games/server/blackjack";

/* ------------------------------------------------------------------ */
/* No hidden balance writes                                            */
/* ------------------------------------------------------------------ */

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? sourceFiles(p) : /\.(ts|tsx)$/.test(name) ? [p] : [];
  });
}

describe("balance changes are always audited", () => {
  it("only the wallet service writes Wallet.balance", () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(join(process.cwd(), "src"))) {
      if (file.replace(/\\/g, "/").endsWith("src/lib/wallet/service.ts")) continue;
      const code = readFileSync(file, "utf8");
      // any wallet write whose data mentions balance
      const re = /\.wallet\.(update|updateMany|upsert|create|createMany)\(\{[\s\S]{0,600}?\}\)/g;
      for (const m of code.matchAll(re)) if (/\bbalance\s*:/.test(m[0])) offenders.push(`${file}: ${m[0].slice(0, 80)}`);
      if (/\$executeRaw[\s\S]{0,200}?UPDATE\s+"?Wallet"?/i.test(code)) offenders.push(`${file}: raw wallet update`);
    }
    expect(offenders).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
/* Payout configuration                                                */
/* ------------------------------------------------------------------ */

describe("game configuration", () => {
  it("parses with defaults and rejects out-of-range values", () => {
    expect(parseConfig("slots", null)).toEqual({ payScale: 100 });
    expect(parseConfig("slots", '{"payScale":200}')).toEqual({ payScale: 100 }); // invalid -> default
    expect(parseConfig("blackjack", '{"blackjackPays":"6:5"}')).toEqual({ blackjackPays: "6:5", dealerHitsSoft17: false });
    expect(parseConfig("holdem", '{"opponents":9}')).toEqual({ opponents: 3 });
    expect(parseConfig("roulette", "not json")).toEqual({ laPartage: false });
  });

  it("derives the published RTP from the rules", () => {
    expect(publishedRtp("slots", '{"payScale":100}')).toBeCloseTo(SLOTS_BASE_RTP, 5);
    expect(publishedRtp("slots", '{"payScale":100}', true)).toBeCloseTo(SLOTS_BASE_RTP + 1, 5);
    expect(publishedRtp("slots", '{"payScale":90}')).toBeLessThan(publishedRtp("slots", '{"payScale":110}'));
    expect(blackjackRtp({ blackjackPays: "6:5", dealerHitsSoft17: false })).toBeLessThan(blackjackRtp({ blackjackPays: "3:2", dealerHitsSoft17: false }));
    expect(publishedRtp("holdem", null)).toBe(0);
  });

  it("slots pay scale scales every pay and the measured RTP follows the published one", () => {
    const g: Grid = [0, 1, 2, 3, 4].map((r) => [(["club", "diamond", "heart", "spade", "star"] as SymbolId[])[r], "crown", "gem"]);
    for (let i = 0; i < 3; i++) g[i][1] = "crown";
    const base = evaluate(g, { lineBet: 10, lines: 1, freeSpin: false });
    expect(evaluate(g, { lineBet: 10, lines: 1, freeSpin: false, payScale: 110 }).payout).toBe(Math.floor((base.payout * 110) / 100));
    expect(() => evaluate(g, { lineBet: 10, lines: 1, freeSpin: false, payScale: 150 })).toThrow();
    for (const scale of [90, 110]) {
      const s = simulateSlots(seededRng(scale), 300_000, 20, 10, scale);
      expect(s.rtp * 100).toBeGreaterThan(publishedRtp("slots", JSON.stringify({ payScale: scale })) - 1.5);
      expect(s.rtp * 100).toBeLessThan(publishedRtp("slots", JSON.stringify({ payScale: scale })) + 1.5);
    }
  });

  it("blackjack 6:5 and H17 rules", () => {
    expect(payoutFor("blackjack", 100, { blackjackPays: "6:5", dealerHitsSoft17: false })).toBe(220);
    expect(payoutFor("blackjack", 100, { blackjackPays: "3:2", dealerHitsSoft17: false })).toBe(250);
    expect(dealerShouldHit(["As", "6d"], true)).toBe(true);
    expect(dealerShouldHit(["As", "6d"], false)).toBe(false);
    expect(dealerShouldHit(["Ts", "7d"], true)).toBe(false); // hard 17 always stands
    // A hand dealt under 6:5 keeps 6:5 even if rules change later: they are stored on the round.
    const shoe = (...c: Card[]) => c.slice().reverse();
    const bj = deal(seededRng(1), 100, shoe("As", "9h", "Kd", "7c"), { blackjackPays: "6:5", dealerHitsSoft17: false });
    expect(bj.returned).toBe(220);
    const h17 = act(deal(seededRng(1), 100, shoe("Ts", "As", "9d", "6c", "2h"), { blackjackPays: "3:2", dealerHitsSoft17: true }), "stand");
    expect(h17.dealer).toEqual(["As", "6c", "2h"]); // drew on soft 17
  });

  it("La Partage returns half of even-money bets on zero only", () => {
    const bets = [
      { kind: "red" as const, amount: 101 },
      { kind: "dozen" as const, value: 1, amount: 100 },
      { kind: "straight" as const, value: 0, amount: 10 },
    ];
    expect(settle(0, bets, { laPartage: true }).bets.map((b) => b.returned)).toEqual([50, 0, 360]);
    expect(settle(0, bets, { laPartage: false }).bets.map((b) => b.returned)).toEqual([0, 0, 360]);
    expect(settle(3, bets, { laPartage: true }).bets.map((b) => b.returned)).toEqual([202, 300, 0]);
  });
});

/* ------------------------------------------------------------------ */
/* Database: integrity check, disabled games                          */
/* ------------------------------------------------------------------ */

describe("admin data (database)", () => {
  const tag = `a${Date.now().toString(36)}`;
  let userId = "";
  let walletId = "";
  let gameId = "";

  beforeAll(async () => {
    userId = (await prisma.user.create({ data: { username: `${tag}_adm`, displayName: "Admin Test" } })).id;
    const ctx = { actorId: userId, ip: "test" };
    walletId = (await atomic((db) => openWallet(db, userId, 10_000_00, ctx))).id;
    setPlayerForTests({ userId, walletId, ctx });
    gameId = (
      await prisma.game.create({
        data: { slug: `${tag}-bj`, name: "Test BJ", studio: "T", category: "table", tagline: "-", description: "-", rtp: 99, volatility: "low", minBet: 100, maxBet: 10_000, icon: "spade", palette: "obsidian", engine: "blackjack" },
      })
    ).id;
  });

  afterAll(async () => {
    setPlayerForTests(null);
    await prisma.user.delete({ where: { id: userId } });
    await prisma.game.delete({ where: { id: gameId } });
    await prisma.$disconnect();
  });

  it("the integrity check flags a balance change that bypassed the audited service", async () => {
    const before = await getIntegrity();
    // Simulate a forbidden write: a ledger row with no audit record, and a balance that drifts.
    const tx = await prisma.transaction.create({ data: { walletId, type: "adjustment", amount: 1, balanceAfter: 10_000_01, reference: `T-${randomUUID()}` } });
    const flagged = await getIntegrity();
    expect(flagged.unauditedEntries).toBe(before.unauditedEntries + 1);
    expect(flagged.mismatchedWallets).toBe(before.mismatchedWallets + 1);
    await prisma.transaction.delete({ where: { id: tx.id } });
    expect(await getIntegrity()).toEqual(before);
  });

  it("a disabled game refuses new rounds but lets a live round finish", async () => {
    // Deal until a hand needs a decision, then disable the game mid-hand.
    let live = null;
    for (let i = 0; i < 30 && !live; i++) {
      const r = await blackjackDeal({ gameId, bet: 100, requestId: randomUUID() });
      if (r.ok && r.view.phase === "player") live = r;
    }
    expect(live).not.toBeNull();
    await prisma.game.update({ where: { id: gameId }, data: { enabled: false } });

    const blocked = await blackjackDeal({ gameId, bet: 100, requestId: randomUUID() });
    expect(!blocked.ok && blocked.error).toBe("disabled"); // no new rounds on a disabled game
    const finish = await blackjackAct({ roundId: live!.roundId, version: live!.version, action: "stand", requestId: randomUUID() });
    expect(finish.ok).toBe(true);
    const after = await blackjackDeal({ gameId, bet: 100, requestId: randomUUID() });
    expect(!after.ok && after.error).toBe("disabled");
    await prisma.game.update({ where: { id: gameId }, data: { enabled: true } });
  });
});
