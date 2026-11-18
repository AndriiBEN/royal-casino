import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";
import { DEMO_LOGIN as DEMO } from "../src/lib/constants";
import { promotions } from "./promotions";
import { secureRng } from "../src/lib/games/rng";
import { lineBetsFor, nextFreeSpins, spin as spinSlots } from "../src/lib/games/slots/engine";
import { spin as spinRoulette, type Bet } from "../src/lib/games/roulette/engine";
import { act as bjAct, deal as bjDeal } from "../src/lib/games/blackjack/engine";
import { basicStrategy } from "../src/lib/games/blackjack/strategy";
import { randomUUID } from "node:crypto";
import { newHand } from "../src/lib/games/holdem/game";
import { BOT_ROSTER, runBots } from "../src/lib/games/holdem/ai";
import { summarize } from "../src/lib/games/summary";
import { bonusFor } from "../src/lib/vip";
import { publishedRtp } from "../src/lib/games/config";

const prisma = new PrismaClient();

type SeedGame = {
  slug: string;
  name: string;
  studio: string;
  category: "slots" | "live" | "table" | "jackpots" | "instant";
  tagline: string;
  description: string;
  rtp: number;
  volatility: "low" | "medium" | "high";
  minBet: number;
  maxBet: number;
  jackpot?: number;
  players: number;
  icon: string;
  palette: string;
  isNew?: boolean;
  isHot?: boolean;
  isFeatured?: boolean;
  /** which engine plays this game; defaults to slots */
  engine?: "slots" | "blackjack" | "roulette" | "holdem";
  /** engine options (JSON-serialised into Game.config) */
  config?: Record<string, unknown>;
};

const games: SeedGame[] = [
  // Slots
  {
    slug: "gilded-pharaoh",
    name: "Gilded Pharaoh",
    studio: "Aurum Studios",
    category: "slots",
    tagline: "Unearth the vaults of a forgotten dynasty",
    description:
      "Golden masks and scarab wilds under the pyramid. 5 reels, up to 20 paylines, wilds that double line wins and scatters that pay anywhere. Three or more scatters start the free-spins round, where every win is tripled.",
    rtp: 95.6,
    volatility: "high",
    minBet: 20,
    maxBet: 10000,
    players: 1284,
    icon: "pyramid",
    palette: "amber",
    isHot: true,
    isFeatured: true,
  },
  {
    slug: "velvet-sevens",
    name: "Velvet Sevens",
    studio: "Noir & Gold",
    category: "slots",
    tagline: "Classic sevens with a midnight-lounge finish",
    description:
      "Lucky sevens on velvet. 5 reels, up to 20 paylines, wilds that double line wins and scatters that pay anywhere. Three or more scatters start the free-spins round, where every win is tripled. Play a single line for the classic feel.",
    rtp: 95.6,
    volatility: "low",
    minBet: 10,
    maxBet: 5000,
    players: 642,
    icon: "seven",
    palette: "crimson",
  },
  {
    slug: "dragon-ember",
    name: "Dragon Ember",
    studio: "Lantern Forge",
    category: "slots",
    tagline: "Wake the dragon, claim the hoard",
    description:
      "Ember wilds and a dragon's hoard of crowns and gems. 5 reels, up to 20 paylines, wilds that double line wins and scatters that pay anywhere. Three or more scatters start the free-spins round, where every win is tripled.",
    rtp: 95.6,
    volatility: "high",
    minBet: 20,
    maxBet: 12500,
    players: 2106,
    icon: "flame",
    palette: "ember",
    isHot: true,
    isFeatured: true,
  },
  {
    slug: "monaco-nights",
    name: "Monaco Nights",
    studio: "Aurum Studios",
    category: "slots",
    tagline: "Yachts, champagne and wild nights",
    description:
      "Champagne wilds on the harbour at midnight. 5 reels, up to 20 paylines, wilds that double line wins and scatters that pay anywhere. Three or more scatters start the free-spins round, where every win is tripled.",
    rtp: 95.6,
    volatility: "medium",
    minBet: 20,
    maxBet: 8000,
    players: 873,
    icon: "gem",
    palette: "sapphire",
    isNew: true,
  },
  {
    slug: "emerald-oracle",
    name: "Emerald Oracle",
    studio: "Lantern Forge",
    category: "slots",
    tagline: "Ask the oracle, and the reels will answer",
    description:
      "The oracle's emerald eye watches every spin. 5 reels, up to 20 paylines, wilds that double line wins and scatters that pay anywhere. Three or more scatters start the free-spins round, where every win is tripled.",
    rtp: 95.6,
    volatility: "medium",
    minBet: 10,
    maxBet: 6000,
    players: 517,
    icon: "eye",
    palette: "emerald",
    isNew: true,
  },
  {
    slug: "crown-of-olympus",
    name: "Crown of Olympus",
    studio: "Noir & Gold",
    category: "slots",
    tagline: "Thunderbolts and crowns from the heavens",
    description:
      "Olympian crowns and thunderbolt wilds. 5 reels, up to 20 paylines, wilds that double line wins and scatters that pay anywhere. Three or more scatters start the free-spins round, where every win is tripled.",
    rtp: 95.6,
    volatility: "high",
    minBet: 20,
    maxBet: 10000,
    players: 3012,
    icon: "zap",
    palette: "violet",
    isHot: true,
  },
  // Live
  {
    slug: "grand-salon-roulette",
    name: "Grand Salon Roulette",
    studio: "Maison Live",
    category: "live",
    tagline: "European roulette from a private salon",
    description:
      "Single-zero European roulette in an art-deco salon. Back any number at 35 to 1, red or black, odd or even, low or high, dozens and columns. Your recent results stay on screen.",
    rtp: 97.3,
    volatility: "medium",
    minBet: 100,
    maxBet: 500000,
    players: 418,
    icon: "disc",
    palette: "crimson",
    isFeatured: true,
    engine: "roulette",
  },
  {
    slug: "obsidian-blackjack",
    name: "Obsidian Blackjack",
    studio: "Maison Live",
    category: "live",
    tagline: "High-limit blackjack on obsidian felt",
    description:
      "Six decks shuffled every round, dealer stands on all 17s and peeks for blackjack. Blackjack pays 3 to 2, and you can double down on any first two cards. Higher table limits.",
    rtp: 99.0,
    volatility: "medium",
    minBet: 500,
    maxBet: 250000,
    players: 289,
    icon: "spade",
    palette: "obsidian",
    isHot: true,
    engine: "blackjack",
  },
  {
    slug: "high-stakes-holdem",
    name: "High Stakes Hold'em",
    studio: "Maison Live",
    category: "live",
    tagline: "Five-handed Hold'em with bigger blinds",
    description:
      "A full five-handed table against the house's sharpest AI players. Fixed-limit betting with blinds of 5/10 credits, so every street matters.",
    rtp: 0,
    volatility: "high",
    minBet: 1000,
    maxBet: 4000,
    players: 233,
    icon: "crown",
    palette: "royal",
    engine: "holdem",
    config: { opponents: 4 },
  },
  {
    slug: "monte-carlo-roulette",
    name: "Monte Carlo Roulette",
    studio: "Maison Live",
    category: "live",
    tagline: "Single-zero roulette at Riviera limits",
    description:
      "European single-zero roulette with a wide betting range. Straight-up numbers pay 35 to 1, dozens and columns pay 2 to 1 and the even-money chances pay 1 to 1.",
    rtp: 97.3,
    volatility: "medium",
    minBet: 50,
    maxBet: 250000,
    players: 1640,
    icon: "disc",
    palette: "emerald",
    isHot: true,
    engine: "roulette",
  },
  // Table
  {
    slug: "classic-blackjack",
    name: "Classic Blackjack",
    studio: "Noir & Gold",
    category: "table",
    tagline: "Six decks, dealer stands on 17",
    description:
      "The classic game: hit, stand or double on your first two cards. The dealer stands on all 17s, peeks for blackjack and pays naturals 3 to 2.",
    rtp: 99.0,
    volatility: "low",
    minBet: 100,
    maxBet: 100000,
    players: 702,
    icon: "spade",
    palette: "emerald",
    engine: "blackjack",
  },
  {
    slug: "french-roulette-gold",
    name: "French Roulette Gold",
    studio: "Aurum Studios",
    category: "table",
    tagline: "Single-zero roulette with a gilded wheel",
    description:
      "Classic single-zero roulette on a gold-trimmed table. Every bet carries the same 2.70% house edge, from straight-up numbers to the even-money chances.",
    rtp: 97.3,
    volatility: "low",
    minBet: 10,
    maxBet: 200000,
    players: 233,
    icon: "disc",
    palette: "sapphire",
    engine: "roulette",
  },
  {
    slug: "midnight-holdem",
    name: "Midnight Hold'em",
    studio: "Noir & Gold",
    category: "table",
    tagline: "Fixed-limit Texas Hold'em against three AI regulars",
    description:
      "Take a seat against Viktor, Isabella and Marcel in fixed-limit Texas Hold'em. Two hole cards, five community cards, four betting rounds and a real showdown. Blinds 0.50/1 credits.",
    rtp: 0,
    volatility: "medium",
    minBet: 100,
    maxBet: 400,
    players: 512,
    icon: "club",
    palette: "obsidian",
    isFeatured: true,
    engine: "holdem",
    config: { opponents: 3 },
  },
  {
    slug: "heads-up-holdem",
    name: "Heads-Up Hold'em",
    studio: "Lantern Forge",
    category: "table",
    tagline: "One opponent, every hand a duel",
    description:
      "Heads-up fixed-limit Hold'em against Viktor. The button posts the small blind and acts first pre-flop, as in real heads-up play.",
    rtp: 0,
    volatility: "medium",
    minBet: 200,
    maxBet: 800,
    players: 301,
    icon: "spade",
    palette: "sapphire",
    isNew: true,
    engine: "holdem",
    config: { opponents: 1 },
  },
  // Jackpots
  {
    slug: "sovereign-millions",
    name: "Sovereign Millions",
    studio: "Aurum Studios",
    category: "jackpots",
    tagline: "The crown jewel of progressive jackpots",
    description:
      "The Sovereign pool grows with every spin played here. A progressive pool funded by 1% of every stake can drop on any paid spin; the bigger the stake, the better the chance. 5 reels, up to 20 paylines, wilds that double line wins and scatters that pay anywhere. Three or more scatters start the free-spins round, where every win is tripled.",
    rtp: 96.6,
    volatility: "high",
    minBet: 50,
    maxBet: 5000,
    jackpot: 482_193_75,
    players: 4210,
    icon: "crown",
    palette: "amber",
    isFeatured: true,
    isHot: true,
  },
  {
    slug: "diamond-vault",
    name: "Diamond Vault",
    studio: "Noir & Gold",
    category: "jackpots",
    tagline: "Crack the vault before anyone else does",
    description:
      "A vault of diamonds behind every reel. A progressive pool funded by 1% of every stake can drop on any paid spin; the bigger the stake, the better the chance. 5 reels, up to 20 paylines, wilds that double line wins and scatters that pay anywhere. Three or more scatters start the free-spins round, where every win is tripled.",
    rtp: 96.6,
    volatility: "high",
    minBet: 20,
    maxBet: 4000,
    jackpot: 128_440_20,
    players: 1588,
    icon: "vault",
    palette: "sapphire",
  },
  {
    slug: "golden-lotus-jackpot",
    name: "Golden Lotus",
    studio: "Lantern Forge",
    category: "jackpots",
    tagline: "Blooming wins and a growing lotus pool",
    description:
      "Lotus wilds open on the reels. A progressive pool funded by 1% of every stake can drop on any paid spin; the bigger the stake, the better the chance. 5 reels, up to 20 paylines, wilds that double line wins and scatters that pay anywhere. Three or more scatters start the free-spins round, where every win is tripled.",
    rtp: 96.6,
    volatility: "medium",
    minBet: 20,
    maxBet: 6000,
    jackpot: 24_315_60,
    players: 932,
    icon: "flower",
    palette: "emerald",
    isNew: true,
  },
  {
    slug: "empress-fortune",
    name: "Empress Fortune",
    studio: "Aurum Studios",
    category: "jackpots",
    tagline: "Royal riches await the bold",
    description:
      "Pearls and crowns for the Empress. A progressive pool funded by 1% of every stake can drop on any paid spin; the bigger the stake, the better the chance. 5 reels, up to 20 paylines, wilds that double line wins and scatters that pay anywhere. Three or more scatters start the free-spins round, where every win is tripled.",
    rtp: 96.6,
    volatility: "medium",
    minBet: 50,
    maxBet: 8000,
    jackpot: 71_902_10,
    players: 1203,
    icon: "gem",
    palette: "violet",
  },
  // Instant
  {
    slug: "express-roulette",
    name: "Express Roulette",
    studio: "Starlight Broadcast",
    category: "instant",
    tagline: "Place, spin, settle in seconds",
    description:
      "Fast single-zero roulette for quick sessions: low minimums, instant settlement and your last results always on screen.",
    rtp: 97.3,
    volatility: "medium",
    minBet: 10,
    maxBet: 20000,
    players: 2877,
    icon: "disc",
    palette: "ember",
    isHot: true,
    engine: "roulette",
  },
  {
    slug: "turbo-blackjack",
    name: "Turbo Blackjack",
    studio: "Starlight Broadcast",
    category: "instant",
    tagline: "Blackjack with small stakes and quick hands",
    description:
      "Standard rules at speed: dealer stands on 17, blackjack pays 3:2 and you can double on any first two cards. Stakes from 0.10 credits.",
    rtp: 99.0,
    volatility: "low",
    minBet: 10,
    maxBet: 10000,
    players: 1490,
    icon: "spade",
    palette: "obsidian",
    isNew: true,
    engine: "blackjack",
  },
  {
    slug: "golden-sprint",
    name: "Golden Sprint",
    studio: "Starlight Broadcast",
    category: "instant",
    tagline: "Lightning-fast reels from one line up",
    description:
      "Quick-fire reels with wilds, scatters and the free-spins bonus. Play a single line for tiny stakes or all twenty for full coverage.",
    rtp: 95.6,
    volatility: "medium",
    minBet: 1,
    maxBet: 2000,
    players: 1102,
    icon: "zap",
    palette: "amber",
  },
  {
    slug: "lucky-crown-reels",
    name: "Lucky Crown Reels",
    studio: "Noir & Gold",
    category: "instant",
    tagline: "Three scatters open eight free spins at triple pay",
    description:
      "Crown-themed reels built for short sessions. Land three or more scatters anywhere to trigger free spins where every win is tripled.",
    rtp: 95.6,
    volatility: "low",
    minBet: 5,
    maxBet: 2000,
    players: 388,
    icon: "ticket",
    palette: "crimson",
  },
];



const vipTiers = [
  {
    level: 1,
    name: "Bronze",
    minPoints: 0,
    dailyBonus: 1_000_00,
    perks: "Daily demo bonus from 1,000 credits\nStreak boost up to +50%\n8 starter avatars\nBronze avatar ring",
  },
  {
    level: 2,
    name: "Silver",
    minPoints: 5_000,
    dailyBonus: 1_500_00,
    perks: "Daily bonus base 1,500 credits\nEmber and Silver Quill avatars\nSilver avatar ring",
  },
  {
    level: 3,
    name: "Gold",
    minPoints: 25_000,
    dailyBonus: 2_500_00,
    perks: "Daily bonus base 2,500 credits\nRoyal Keep and Duellist avatars\nGold avatar ring",
  },
  {
    level: 4,
    name: "Platinum",
    minPoints: 100_000,
    dailyBonus: 4_000_00,
    perks: "Daily bonus base 4,000 credits\nPlatinum Sun avatar\nPlatinum avatar ring",
  },
  {
    level: 5,
    name: "Diamond",
    minPoints: 500_000,
    dailyBonus: 6_000_00,
    perks: "Daily bonus base 6,000 credits\nDiamond Heart avatar\nAnimated Diamond avatar ring",
  },
];

/** Showcase players: they have play history but no password, so nobody can sign in as them. */
const showcasePlayers = [
  ["velvet_ace", "Velvet Ace"],
  ["monaco_max", "Monaco Max"],
  ["lady_luck", "Lady Luck"],
  ["goldfinch", "Goldfinch"],
  ["the_baron", "The Baron"],
  ["queen_of_hearts", "Queen of Hearts"],
  ["night_owl", "Night Owl"],
  ["high_roller_88", "High Roller 88"],
] as const;

const SIGNUP = 10_000_00;

async function main() {
  // Admin accounts are preserved so re-seeding never locks you out of /admin.
  // Their wallets keep their balance; transactions pointing at old games lose the game link.
  await prisma.session.deleteMany({ where: { user: { role: "USER" } } });
  await prisma.user.deleteMany({ where: { role: "USER" } });
  await prisma.favorite.deleteMany();
  await prisma.game.deleteMany();
  await prisma.promotion.deleteMany();
  await prisma.vipTier.deleteMany();

  for (const { config, engine, ...g } of games) {
    await prisma.game.create({
      data: {
        ...g,
        engine: engine ?? "slots",
        config: config ? JSON.stringify(config) : null,
        // Published RTP comes from the same function the admin console uses, never a typed number.
        rtp: publishedRtp(engine ?? "slots", config ? JSON.stringify(config) : null, g.category === "jackpots" && g.jackpot !== undefined),
        // The pool resets to its opening value after it is won.
        jackpotSeed: g.jackpot ?? null,
      },
    });
  }
  for (const p of promotions) await prisma.promotion.create({ data: p });
  for (const t of vipTiers) await prisma.vipTier.create({ data: t });

  const guest = await prisma.user.create({
    data: {
      username: DEMO.username,
      email: "guest@royal.local",
      displayName: "Royal Guest",
      passwordHash: await hashPassword(DEMO.password),
      role: "USER",
      // Joined before the simulated history below, so the ledger reads in order.
      createdAt: new Date(Date.now() - 11 * 86_400_000),
      wallet: {
        create: {
          balance: SIGNUP,
          transactions: { create: { type: "signup", amount: SIGNUP, balanceAfter: SIGNUP, createdAt: new Date(Date.now() - 11 * 86_400_000) } },
        },
      },
    },
  });

  const favs = await prisma.game.findMany({
    where: { slug: { in: ["gilded-pharaoh", "obsidian-blackjack"] } },
  });
  for (const g of favs) {
    await prisma.favorite.create({ data: { userId: guest.id, gameId: g.id } });
  }

  // Simulate play history with the real engines so winners and statistics are genuine outcomes.
  // Hold'em is left out: its results depend on the AI table rather than a fixed edge.
  const allGames = (await prisma.game.findMany()).filter((g) => g.engine !== "holdem");
  const rand = (max: number) => secureRng.int(max);
  const now = Date.now();
  let rounds = 0;

  /** Plays one round and returns [stake, return] in cents, or null if the stake does not fit the game. */
  function playOne(game: (typeof allGames)[number]): [number, number, string] | null {
    if (game.engine === "slots") {
      const lineBets = lineBetsFor(game.minBet, game.maxBet, 20).filter((b) => b * 20 >= 100 && b * 20 <= 10_000);
      if (!lineBets.length) return null;
      const lineBet = lineBets[Math.min(lineBets.length - 1, rand(lineBets.length) + rand(2))];
      const first = spinSlots(secureRng, { lineBet, lines: 20, freeSpin: false });
      let ret = first.payout;
      let free = nextFreeSpins(0, false, first.scatter.freeSpins);
      while (free > 0) {
        const f = spinSlots(secureRng, { lineBet, lines: 20, freeSpin: true });
        ret += f.payout;
        free = nextFreeSpins(free, true, f.scatter.freeSpins);
      }
      return [lineBet * 20, ret, "win"];
    }
    const stake = Math.max(game.minBet, [100, 200, 500, 1_000, 2_500][rand(5)]);
    if (stake > game.maxBet) return null;
    if (game.engine === "roulette") {
      const bet: Bet = rand(3) === 0 ? { kind: "straight", value: rand(37), amount: stake } : { kind: rand(2) ? "red" : "black", amount: stake };
      return [stake, spinRoulette(secureRng, [bet]).returned, "win"];
    }
    let h = bjDeal(secureRng, stake);
    while (h.phase === "player") h = bjAct(h, basicStrategy(h));
    return [h.bet, h.returned, h.outcome === "push" ? "refund" : "win"];
  }

  for (const [username, displayName] of showcasePlayers) {
    const start = now - 1000 * 60 * 60 * 72;
    const rows: {
      type: string;
      amount: number;
      balanceAfter: number;
      gameId?: string;
      multiplier?: number;
      createdAt: Date;
    }[] = [{ type: "signup", amount: SIGNUP, balanceAfter: SIGNUP, createdAt: new Date(start) }];

    let balance = SIGNUP;
    let wagered = 0;
    const sessionGames = Array.from({ length: 4 }, () => allGames[rand(allGames.length)]);
    const plays = 40 + rand(40);

    for (let i = 0; i < plays; i++) {
      const game = sessionGames[i % sessionGames.length];
      const r = playOne(game);
      if (!r) continue;
      const [stake, returned, type] = r;
      if (stake > balance) break;

      const at = new Date(start + ((now - start) * (i + 1)) / (plays + 1));
      balance -= stake;
      wagered += stake;
      rows.push({ type: "bet", amount: -stake, balanceAfter: balance, gameId: game.id, createdAt: at });
      if (returned > 0) {
        balance += returned;
        rows.push({
          type,
          amount: returned,
          balanceAfter: balance,
          gameId: game.id,
          multiplier: type === "win" ? Math.round((returned / stake) * 100) / 100 : undefined,
          createdAt: new Date(at.getTime() + 1500),
        });
      }
      rounds++;
    }

    // No email and no password hash: these accounts cannot sign in.
    await prisma.user.create({
      data: {
        username,
        displayName,
        role: "USER",
        vipPoints: Math.floor(wagered / 100), // simulated activity only
        createdAt: new Date(start),
        wallet: { create: { balance, createdAt: new Date(start), transactions: { create: rows } } },
      },
    });
  }

  await seedGuestHistory(guest.id);

  const audited = await auditSeededLedger();

  const admins = await prisma.user.count({ where: { role: "ADMIN" } });
  console.log(
    `Seeded ${games.length} games, ${promotions.length} promotions, ${vipTiers.length} VIP tiers, ` +
      `${showcasePlayers.length + 1} users and ${rounds} simulated rounds (${audited} ledger entries audited).
` +
      `Demo USER login: ${DEMO.username} / ${DEMO.password}
` +
      (admins ? `Kept ${admins} existing admin account(s).` : "No admin yet. Create one with: npm run db:seed:admin"),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

/**
 * Gives the demo guest a believable history played through the real engines (secure RNG):
 * settled GameRounds with summaries, matching ledger rows, a 3-day bonus streak, and Crown
 * Points equal to what was staked. Nothing is invented: every number comes from play.
 */
async function seedGuestHistory(userId: string) {
  const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId } });
  const bySlug = async (slug: string) => prisma.game.findUniqueOrThrow({ where: { slug } });
  const [slots, blackjack, roulette, holdem] = await Promise.all([
    bySlug("gilded-pharaoh"),
    bySlug("classic-blackjack"),
    bySlug("grand-salon-roulette"),
    bySlug("midnight-holdem"),
  ]);
  const rand = (max: number) => secureRng.int(max);
  const DAY = 86_400_000;
  const now = Date.now();
  let balance = wallet.balance;
  let wagered = 0;
  const txs: { type: string; amount: number; balanceAfter: number; gameId?: string; multiplier?: number; note?: string; createdAt: Date }[] = [];

  async function record(gameId: string, engine: string, state: unknown, staked: number, returned: number, at: Date) {
    balance -= staked;
    wagered += staked;
    // A hold'em fold before any chips went in costs nothing: no ledger row.
    if (staked > 0) txs.push({ type: "bet", amount: -staked, balanceAfter: balance, gameId, createdAt: at });
    if (returned > 0) {
      balance += returned;
      const push = returned === staked && engine === "blackjack";
      txs.push({
        type: push ? "refund" : "win",
        amount: returned,
        balanceAfter: balance,
        gameId,
        multiplier: push ? undefined : Math.round((returned / staked) * 100) / 100,
        createdAt: new Date(at.getTime() + 1200),
      });
    }
    await prisma.gameRound.create({
      data: {
        userId,
        gameId,
        engine,
        status: "settled",
        state: JSON.stringify(state),
        requestId: randomUUID(),
        staked,
        returned,
        summary: JSON.stringify(summarize(engine, state)),
        createdAt: at,
        updatedAt: at,
        settledAt: at,
      },
    });
  }

  const total = 72;
  for (let i = 0; i < total; i++) {
    // Spread over the last 10 days, a few sessions a day.
    const at = new Date(now - 10 * DAY + ((i + 0.5) / total) * 10 * DAY - rand(3_600_000));
    const pick = i % 6;
    if (pick <= 1) {
      const lineBet = [5, 10, 20][rand(3)];
      const lines = [10, 20][rand(2)];
      const first = spinSlots(secureRng, { lineBet, lines, freeSpin: false });
      let free = nextFreeSpins(0, false, first.scatter.freeSpins);
      let bonusWin = 0;
      let played = 0;
      let last = first;
      while (free > 0) {
        last = spinSlots(secureRng, { lineBet, lines, freeSpin: true });
        bonusWin += last.payout;
        played++;
        free = nextFreeSpins(free, true, last.scatter.freeSpins);
      }
      const state = { lineBet, lines, freeSpinsLeft: 0, freeSpinsPlayed: played, bonusWin, wasFreeSpin: played > 0, last, jackpotWon: null };
      await record(slots.id, "slots", state, lineBet * lines, first.payout + bonusWin, at);
    } else if (pick <= 3) {
      let h = bjDeal(secureRng, [100, 200, 500][rand(3)]);
      while (h.phase === "player") h = bjAct(h, basicStrategy(h));
      await record(blackjack.id, "blackjack", h, h.bet, h.returned, at);
    } else if (pick === 4) {
      const bets: Bet[] = [{ kind: rand(2) ? "red" : "black", amount: 200 }];
      if (rand(2)) bets.push({ kind: "straight", value: rand(37), amount: 100 });
      if (rand(3) === 0) bets.push({ kind: "dozen", value: 1 + rand(3), amount: 100 });
      const r = spinRoulette(secureRng, bets);
      await record(roulette.id, "roulette", r, r.staked, r.returned, at);
    } else {
      // The guest's seat is played by a steady bot persona, then stored as the human seat.
      const seats = [
        { name: "You", human: false, personality: { tight: 0.55, aggression: 0.45, bluff: 0.06 } },
        ...BOT_ROSTER.slice(0, 3).map((b) => ({ name: b.name, human: false, personality: b.personality })),
      ];
      const hand = runBots(newHand(secureRng, seats, rand(4), 100), secureRng, 120);
      hand.seats[0].human = true;
      hand.seats[0].personality = null;
      const won = hand.winners.filter((w) => w.seat === 0).reduce((a, w) => a + w.amount, 0);
      await record(holdem.id, "holdem", hand, hand.seats[0].committed, won, at);
    }
  }

  // Three daily bonuses in a row, the last one 25 hours ago, so today's claim continues the streak.
  let streak = 0;
  for (let d = 3; d >= 1; d--) {
    streak++;
    const amount = bonusFor(1_000_00, streak);
    balance += amount;
    txs.push({ type: "bonus", amount, balanceAfter: balance, note: `Daily demo bonus · Bronze · day ${streak}`, createdAt: new Date(now - d * DAY - 3_600_000) });
  }

  txs.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  // Recompute running balances in time order so every balanceAfter is consistent.
  let running = wallet.balance;
  for (const t of txs) {
    running += t.amount;
    t.balanceAfter = running;
  }
  await prisma.transaction.createMany({ data: txs.map((t) => ({ ...t, walletId: wallet.id })) });
  await prisma.wallet.update({
    where: { id: wallet.id },
    data: { balance: running, lastBonusAt: new Date(now - DAY - 3_600_000), bonusStreak: streak },
  });
  await prisma.user.update({ where: { id: userId }, data: { vipPoints: Math.floor(wagered / 100) } });
}

/**
 * Every completed ledger entry must have an audit record (the admin dashboard checks this).
 * Seeded history is written directly, so record each seeded entry here as "seed.history".
 */
export async function auditSeededLedger() {
  const missing = await prisma.$queryRaw<{ id: string; walletId: string; amount: number; balanceAfter: number; createdAt: string | Date }[]>`
    SELECT t.id, t.walletId, t.amount, t.balanceAfter, t.createdAt FROM "Transaction" t
    WHERE t.status = 'completed' AND NOT EXISTS (SELECT 1 FROM "AuditLog" a WHERE a.transactionId = t.id)`;
  for (let i = 0; i < missing.length; i += 500) {
    await prisma.auditLog.createMany({
      data: missing.slice(i, i + 500).map((t) => ({
        action: "seed.history",
        walletId: t.walletId,
        transactionId: t.id,
        amount: Number(t.amount),
        balanceBefore: Number(t.balanceAfter) - Number(t.amount),
        balanceAfter: Number(t.balanceAfter),
        ip: "seed",
        createdAt: new Date(t.createdAt),
        details: JSON.stringify({ source: "npm run db:seed" }),
      })),
    });
  }
  return missing.length;
}
