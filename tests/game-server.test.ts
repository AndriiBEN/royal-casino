/**
 * Integration tests: the real server game functions against the SQLite database, acting
 * as a throwaway user. Checks duplicate protection, stale/illegal moves, funds, secrecy
 * of server state and that every credit is backed by the ledger.
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { atomic, openWallet } from "@/lib/wallet/service";
import { setPlayerForTests, type Played } from "@/lib/games/server/context";
import { rouletteSpin } from "@/lib/games/server/roulette";
import { blackjackAct, blackjackDeal, type BlackjackView } from "@/lib/games/server/blackjack";
import { holdemAct, holdemStart } from "@/lib/games/server/holdem";
import { slotsFreeSpin, slotsSpin, type SlotsView } from "@/lib/games/server/slots";
import { spin as spinSlots } from "@/lib/games/slots/engine";
import { secureRng } from "@/lib/games/rng";

const tag = `t${Date.now().toString(36)}`;
let userId = "";
let walletId = "";
const games: Record<string, string> = {};

const balance = async () => (await prisma.wallet.findUniqueOrThrow({ where: { id: walletId } })).balance;
const ledger = async () =>
  (await prisma.transaction.aggregate({ where: { walletId, status: "completed" }, _sum: { amount: true } }))._sum.amount ?? 0;
const rid = () => randomUUID();

async function makeGame(engine: string, extra: Record<string, unknown> = {}) {
  const g = await prisma.game.create({
    data: {
      slug: `${tag}-${engine}-${Object.keys(games).length}`,
      name: `Test ${engine}`,
      studio: "Test",
      category: engine === "slots" ? "slots" : "table",
      tagline: "-",
      description: "-",
      rtp: 0,
      volatility: "low",
      minBet: 100,
      maxBet: 100_000,
      icon: "spade",
      palette: "obsidian",
      engine,
      ...extra,
    },
  });
  return g.id;
}

beforeAll(async () => {
  const user = await prisma.user.create({ data: { username: `${tag}_games`, displayName: "Game Test" } });
  userId = user.id;
  const ctx = { actorId: userId, ip: "test" };
  walletId = (await atomic((db) => openWallet(db, userId, 50_000_00, ctx))).id;
  setPlayerForTests({ userId, walletId, ctx });
  games.roulette = await makeGame("roulette");
  games.blackjack = await makeGame("blackjack");
  games.holdem = await makeGame("holdem", { config: JSON.stringify({ opponents: 3 }) });
  games.slots = await makeGame("slots", { minBet: 20, maxBet: 10_000 });
  games.jackpot = await makeGame("slots", { minBet: 20, maxBet: 10_000, category: "jackpots", jackpot: 1_000_000_000, jackpotSeed: 1_000_000_000 });
});

afterAll(async () => {
  setPlayerForTests(null);
  await prisma.user.delete({ where: { id: userId } });
  await prisma.game.deleteMany({ where: { slug: { startsWith: tag } } });
  await prisma.$disconnect();
});

beforeEach(async () => {
  // Every test starts and ends with the wallet matching its ledger.
  expect(await ledger()).toBe(await balance());
});

describe("roulette (server)", () => {
  it("settles a spin from the server result and pays exactly the engine's return", async () => {
    const before = await balance();
    const r = await rouletteSpin({ gameId: games.roulette, bets: [{ kind: "red", amount: 500 }, { kind: "straight", value: 7, amount: 100 }], requestId: rid() });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.view.staked).toBe(600);
    const expected = (r.view.color === "red" ? 1000 : 0) + (r.view.number === 7 ? 3600 : 0);
    expect(r.view.returned).toBe(expected);
    expect(await balance()).toBe(before - 600 + expected);
    expect(r.balance).toBe(await balance());
  });

  it("answers a replayed request with the original result and charges once", async () => {
    const requestId = rid();
    const first = await rouletteSpin({ gameId: games.roulette, bets: [{ kind: "black", amount: 200 }], requestId });
    const after = await balance();
    const again = await rouletteSpin({ gameId: games.roulette, bets: [{ kind: "black", amount: 200 }], requestId });
    expect(again.ok && again.replay).toBe(true);
    expect(again.ok && first.ok && again.view.number === first.view.number).toBe(true);
    expect(await balance()).toBe(after);
  });

  it("charges once when the same request arrives in parallel", async () => {
    const requestId = rid();
    const before = await balance();
    const results = await Promise.all(Array.from({ length: 6 }, () => rouletteSpin({ gameId: games.roulette, bets: [{ kind: "odd", amount: 300 }], requestId })));
    const rounds = new Set(results.filter((r) => r.ok).map((r) => r.ok && r.roundId));
    expect(rounds.size).toBe(1);
    const r = results.find((x) => x.ok)!;
    expect(await balance()).toBe(before - 300 + (r.ok ? r.view.returned : 0));
  });

  it("ignores client-supplied payout fields and rejects invalid or out-of-limit bets", async () => {
    const before = await balance();
    const forged = await rouletteSpin({
      gameId: games.roulette,
      bets: [{ kind: "red", amount: 100, returned: 999_999, won: true } as never],
      requestId: rid(),
    });
    expect(forged.ok && forged.view.returned).toBe(forged.ok && forged.view.color === "red" ? 200 : 0);
    const net = await balance();
    expect(net - before).toBe(forged.ok ? forged.view.returned - 100 : 0);

    expect((await rouletteSpin({ gameId: games.roulette, bets: [{ kind: "straight", value: 40, amount: 100 }], requestId: rid() })).ok).toBe(false);
    const big = await rouletteSpin({ gameId: games.roulette, bets: [{ kind: "red", amount: 100_001 }], requestId: rid() });
    expect(!big.ok && big.error).toBe("limits");
    const wrongEngine = await rouletteSpin({ gameId: games.blackjack, bets: [{ kind: "red", amount: 100 }], requestId: rid() });
    expect(!wrongEngine.ok && wrongEngine.error).toBe("invalid");
    expect(await balance()).toBe(net);
  });
});

describe("blackjack (server)", () => {
  async function dealUntilActive() {
    for (let i = 0; i < 40; i++) {
      const r = await blackjackDeal({ gameId: games.blackjack, bet: 1000, requestId: rid() });
      if (r.ok && r.view.phase === "player") return r;
    }
    throw new Error("no playable hand dealt");
  }

  it("keeps the shoe and the hole card on the server", async () => {
    const r = await dealUntilActive();
    if (!r.ok) return;
    expect(r.view.dealer[1]).toBeNull();
    expect(JSON.stringify(r)).not.toMatch(/shoe/);
    const round = await prisma.gameRound.findUniqueOrThrow({ where: { id: r.roundId } });
    expect(JSON.parse(round.state).shoe.length).toBeGreaterThan(250);
    await blackjackAct({ roundId: r.roundId, version: r.version, action: "stand", requestId: rid() });
  });

  it("allows one live hand per table", async () => {
    const r = await dealUntilActive();
    const second = await blackjackDeal({ gameId: games.blackjack, bet: 1000, requestId: rid() });
    expect(!second.ok && second.error).toBe("active");
    expect(!second.ok && second.roundId).toBe(r.ok && r.roundId);
    if (r.ok) await blackjackAct({ roundId: r.roundId, version: r.version, action: "stand", requestId: rid() });
  });

  it("rejects stale versions, replays the last action and applies parallel moves once", async () => {
    const r = await dealUntilActive();
    if (!r.ok) return;
    const before = await balance();

    // Six different requests race on the same version: exactly one is applied.
    const racing = await Promise.all(
      Array.from({ length: 6 }, () => blackjackAct({ roundId: r.roundId, version: r.version, action: "double", requestId: rid() })),
    );
    expect(racing.filter((x) => x.ok).length).toBe(1);
    expect(racing.filter((x) => !x.ok && x.error === "stale").length).toBe(5);
    const applied = racing.find((x) => x.ok)!;
    if (!applied.ok) return;
    expect(applied.view.doubled).toBe(true);
    expect(applied.view.phase).toBe("settled");
    // Exactly one extra stake of 1,000 was taken, then the settlement.
    expect(await balance()).toBe(before - 1000 + applied.view.returned);

    const round = await prisma.gameRound.findUniqueOrThrow({ where: { id: r.roundId } });
    const replay = await blackjackAct({ roundId: r.roundId, version: r.version, action: "double", requestId: round.lastRequestId! });
    expect(replay.ok && replay.replay).toBe(true);
    expect(await balance()).toBe(before - 1000 + applied.view.returned);
  });

  it("rejects illegal moves without touching the wallet", async () => {
    let r: Played<BlackjackView> = await dealUntilActive();
    if (!r.ok) return;
    // Hit until the hand has three cards, then try to double.
    while (r.ok && r.view.phase === "player" && r.view.player.length < 3) {
      r = await blackjackAct({ roundId: r.roundId, version: r.version, action: "hit", requestId: rid() });
    }
    if (!r.ok || r.view.phase !== "player") return; // busted or hit 21; nothing more to test this hand
    const before = await balance();
    const bad = await blackjackAct({ roundId: r.roundId, version: r.version, action: "double", requestId: rid() });
    expect(!bad.ok && bad.error).toBe("illegal");
    expect(await balance()).toBe(before);
    await blackjackAct({ roundId: r.roundId, version: r.version, action: "stand", requestId: rid() });
  });

  it("records stake and return on the round to match the ledger", async () => {
    const rounds = await prisma.gameRound.findMany({ where: { userId, engine: "blackjack", status: "settled" } });
    const txs = await prisma.transaction.findMany({ where: { walletId, gameId: games.blackjack } });
    const staked = -txs.filter((t) => t.type === "bet").reduce((a, t) => a + t.amount, 0);
    const returned = txs.filter((t) => t.type !== "bet").reduce((a, t) => a + t.amount, 0);
    expect(rounds.reduce((a, r) => a + r.staked, 0)).toBe(staked);
    expect(rounds.reduce((a, r) => a + r.returned, 0)).toBe(returned);
  });
});

describe("hold'em (server)", () => {
  it("plays a full hand against AI, hides opponents' cards and pays the pot correctly", async () => {
    const before = await balance();
    let r = await holdemStart({ gameId: games.holdem, requestId: rid() });
    expect(r.ok).toBe(true);
    let guard = 0;
    while (r.ok && !r.view.finished) {
      if (guard++ > 30) throw new Error("hand did not finish");
      for (const seat of r.view.seats.slice(1)) expect(seat.hole).toEqual([null, null]);
      const move = r.view.moves.includes("check") ? "check" : "call";
      r = await holdemAct({ roundId: r.roundId, version: r.version, move, requestId: rid() });
    }
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const round = await prisma.gameRound.findUniqueOrThrow({ where: { id: r.roundId } });
    expect(round.status).toBe("settled");
    const myWin = r.view.winners.filter((w) => w.seat === 0).reduce((a, w) => a + w.amount, 0);
    expect(round.staked).toBe(r.view.seats[0].committed);
    expect(round.returned).toBe(myWin);
    expect(await balance()).toBe(before - round.staked + round.returned);
    expect(r.view.winners.reduce((a, w) => a + w.amount, 0)).toBe(r.view.pot);
  });

  it("rejects moves that are not legal for the player", async () => {
    const r = await holdemStart({ gameId: games.holdem, requestId: rid() });
    if (!r.ok || r.view.finished) return;
    const illegal = r.view.moves.includes("check") ? "call" : "check";
    const bad = await holdemAct({ roundId: r.roundId, version: r.version, move: illegal, requestId: rid() });
    expect(!bad.ok && bad.error).toBe("illegal");
    await holdemAct({ roundId: r.roundId, version: r.version, move: r.view.moves.includes("fold") ? "fold" : "check", requestId: rid() });
    // finish it if checking left it open
    let cur = await prisma.gameRound.findUniqueOrThrow({ where: { id: r.roundId } });
    while (cur.status === "active") {
      await holdemAct({ roundId: cur.id, version: cur.version, move: "fold", requestId: rid() }).then(async (x) => {
        if (!x.ok) await holdemAct({ roundId: cur.id, version: cur.version, move: "check", requestId: rid() });
      });
      cur = await prisma.gameRound.findUniqueOrThrow({ where: { id: r.roundId } });
    }
  });
});

describe("slots (server)", () => {
  it("charges the line bet x lines and pays only what the server evaluated", async () => {
    const before = await balance();
    const r = await slotsSpin({ gameId: games.slots, lineBet: 10, lines: 20, requestId: rid() });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.view.totalBet).toBe(200);
    expect(await balance()).toBe(before - 200 + r.view.spin.payout);
    // Finish any free spins it triggered.
    let cur: Played<SlotsView> = r;
    while (cur.ok && cur.view.inBonus) cur = await slotsFreeSpin({ roundId: cur.roundId, version: cur.version, requestId: rid() });
  });

  it("enforces table limits and line counts", async () => {
    const low = await slotsSpin({ gameId: games.slots, lineBet: 1, lines: 1, requestId: rid() });
    expect(!low.ok && low.error).toBe("limits");
    const lines = await slotsSpin({ gameId: games.slots, lineBet: 10, lines: 21, requestId: rid() });
    expect(!lines.ok && lines.error).toBe("invalid");
  });

  it("refuses a spin without funds and changes nothing", async () => {
    const before = await balance();
    await prisma.wallet.update({ where: { id: walletId }, data: { balance: 50 } });
    // Keep the ledger consistent for the beforeEach check: record the manual change.
    await prisma.transaction.create({ data: { walletId, type: "adjustment", amount: 50 - before, balanceAfter: 50, note: "test" } });
    const r = await slotsSpin({ gameId: games.slots, lineBet: 10, lines: 20, requestId: rid() });
    expect(!r.ok && r.error).toBe("funds");
    expect(await balance()).toBe(50);
    await prisma.wallet.update({ where: { id: walletId }, data: { balance: before } });
    await prisma.transaction.create({ data: { walletId, type: "adjustment", amount: before - 50, balanceAfter: before, note: "test" } });
  });

  it("plays a bonus round to the end: free spins cost nothing and block paid spins", async () => {
    // Open a bonus round as if a paid spin had just awarded 3 free spins.
    const last = spinSlots(secureRng, { lineBet: 10, lines: 20, freeSpin: false });
    const round = await prisma.gameRound.create({
      data: {
        userId,
        gameId: games.slots,
        engine: "slots",
        status: "active",
        requestId: rid(),
        state: JSON.stringify({ lineBet: 10, lines: 20, freeSpinsLeft: 3, freeSpinsPlayed: 0, bonusWin: 0, wasFreeSpin: false, last, jackpotWon: null }),
      },
    });
    const blocked = await slotsSpin({ gameId: games.slots, lineBet: 10, lines: 20, requestId: rid() });
    expect(!blocked.ok && blocked.error).toBe("active");
    expect(!blocked.ok && blocked.roundId).toBe(round.id);

    const before = await balance();
    let version = 0;
    let won = 0;
    let r;
    for (;;) {
      r = await slotsFreeSpin({ roundId: round.id, version, requestId: rid() });
      expect(r.ok).toBe(true);
      if (!r.ok) break;
      expect(r.view.wasFreeSpin).toBe(true);
      won += r.view.spin.payout;
      version = r.version;
      if (!r.view.inBonus) break;
    }
    expect(r!.ok && r!.view.bonusWin).toBe(won);
    expect(await balance()).toBe(before + won); // no stake taken for free spins
    expect((await prisma.gameRound.findUniqueOrThrow({ where: { id: round.id } })).status).toBe("settled");
  });

  it("funds the progressive pool with 1% of each stake", async () => {
    const before = (await prisma.game.findUniqueOrThrow({ where: { id: games.jackpot } })).jackpot!;
    let cur: Played<SlotsView> = await slotsSpin({ gameId: games.jackpot, lineBet: 500, lines: 20, requestId: rid() });
    while (cur.ok && cur.view.inBonus) cur = await slotsFreeSpin({ roundId: cur.roundId, version: cur.version, requestId: rid() });
    const after = (await prisma.game.findUniqueOrThrow({ where: { id: games.jackpot } })).jackpot!;
    expect(after - before).toBe(100); // 1% of 10,000
  });
});
