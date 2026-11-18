import type { Rng } from "../rng";

/**
 * Royal Reels v2: pure slot engine.
 *
 * - 5 reels x 3 rows, up to 20 paylines; the player chooses how many are active.
 * - Line wins pay left to right from reel 1 for 3, 4 or 5 matching symbols.
 * - WILD (reels 2-5) substitutes for every symbol except SCATTER. A line win that uses a
 *   wild pays x2 (the wild multiplier).
 * - SCATTER pays anywhere, as a multiple of the total bet, and 3+ scatters trigger the
 *   Free Spins bonus round: 8/12/20 spins at the triggering bet, every win x3.
 *   Scatters during free spins retrigger more spins (capped).
 *
 * All amounts are integer cents and every multiplier is an integer, so payouts are exact.
 */

export const SYMBOLS = ["W", "S", "crown", "gem", "star", "spade", "heart", "club", "diamond"] as const;
export type SymbolId = (typeof SYMBOLS)[number];
export type PaySymbol = Exclude<SymbolId, "W" | "S">;

export const REELS = 5;
export const ROWS = 3;

/** Symbol weights per reel. No wild on reel 1, so every line win is anchored by a real symbol. */
export const REEL_WEIGHTS: Record<SymbolId, number>[] = [
  { W: 0, S: 1, crown: 3, gem: 4, star: 5, spade: 6, heart: 6, club: 9, diamond: 9 },
  { W: 2, S: 1, crown: 3, gem: 4, star: 5, spade: 6, heart: 6, club: 9, diamond: 9 },
  { W: 2, S: 1, crown: 3, gem: 4, star: 5, spade: 6, heart: 6, club: 9, diamond: 9 },
  { W: 2, S: 1, crown: 3, gem: 4, star: 5, spade: 6, heart: 6, club: 9, diamond: 9 },
  { W: 2, S: 1, crown: 3, gem: 4, star: 5, spade: 6, heart: 6, club: 9, diamond: 9 },
];

/** Line pays for 3, 4, 5 of a kind, as a multiple of the line bet. */
export const PAYTABLE: Record<PaySymbol, [number, number, number]> = {
  crown: [30, 120, 600],
  gem: [18, 70, 300],
  star: [12, 45, 175],
  spade: [9, 28, 115],
  heart: [9, 28, 115],
  club: [6, 16, 70],
  diamond: [5, 16, 70],
};

/** Scatter pays for 3, 4, 5 anywhere, as a multiple of the TOTAL bet. */
export const SCATTER_PAY: [number, number, number] = [2, 10, 50];
/** Free spins awarded for 3, 4, 5 scatters. */
export const FREE_SPINS_AWARD: [number, number, number] = [8, 12, 20];
export const FREE_SPIN_MULTIPLIER = 3;
export const WILD_MULTIPLIER = 2;
/** Most free spins that can be banked at once. */
export const MAX_FREE_SPINS = 50;

/** Row index per reel for each payline. Line n is active when n < lines. */
export const PAYLINES: number[][] = [
  [1, 1, 1, 1, 1],
  [0, 0, 0, 0, 0],
  [2, 2, 2, 2, 2],
  [0, 1, 2, 1, 0],
  [2, 1, 0, 1, 2],
  [0, 0, 1, 2, 2],
  [2, 2, 1, 0, 0],
  [1, 0, 0, 0, 1],
  [1, 2, 2, 2, 1],
  [1, 0, 1, 2, 1],
  [1, 2, 1, 0, 1],
  [0, 1, 1, 1, 0],
  [2, 1, 1, 1, 2],
  [0, 1, 0, 1, 0],
  [2, 1, 2, 1, 2],
  [1, 1, 0, 1, 1],
  [1, 1, 2, 1, 1],
  [0, 0, 2, 0, 0],
  [2, 2, 0, 2, 2],
  [0, 2, 0, 2, 0],
];
export const MAX_LINES = PAYLINES.length;
export const LINE_OPTIONS = [1, 5, 10, 15, 20] as const;

/** Column-major: grid[reel][row]. */
export type Grid = SymbolId[][];

export type LineWin = { line: number; symbol: PaySymbol; count: number; wild: boolean; multiplier: number; payout: number };
export type ScatterResult = { count: number; positions: [number, number][]; payout: number; freeSpins: number };
export type SpinEvaluation = { grid: Grid; lineWins: LineWin[]; scatter: ScatterResult; payout: number };

/** `payScale` (percent, 90-110, default 100) scales every pay: the admin's demo payout setting. */
export type SpinParams = { lineBet: number; lines: number; freeSpin: boolean; payScale?: number };

export const PAY_SCALE_MIN = 90;
export const PAY_SCALE_MAX = 110;

const TOTALS = REEL_WEIGHTS.map((w) => Object.values(w).reduce((a, b) => a + b, 0));

export function drawSymbol(rng: Rng, reel: number): SymbolId {
  let r = rng.int(TOTALS[reel]);
  for (const s of SYMBOLS) {
    r -= REEL_WEIGHTS[reel][s];
    if (r < 0) return s;
  }
  throw new Error("unreachable");
}

export function drawGrid(rng: Rng): Grid {
  return Array.from({ length: REELS }, (_, reel) => Array.from({ length: ROWS }, () => drawSymbol(rng, reel)));
}

export function validateParams(p: { lineBet: number; lines: number }) {
  return Number.isSafeInteger(p.lineBet) && p.lineBet > 0 && Number.isInteger(p.lines) && p.lines >= 1 && p.lines <= MAX_LINES;
}

export const totalBet = (p: { lineBet: number; lines: number }) => p.lineBet * p.lines;

/** Evaluates a grid. Pure: the same grid and params always produce the same result. */
export function evaluate(grid: Grid, p: SpinParams): SpinEvaluation {
  if (!validateParams(p)) throw new RangeError("Invalid spin parameters");
  const scale = p.payScale ?? 100;
  if (!Number.isInteger(scale) || scale < PAY_SCALE_MIN || scale > PAY_SCALE_MAX) throw new RangeError("Invalid pay scale");
  const bonus = p.freeSpin ? FREE_SPIN_MULTIPLIER : 1;
  const scaled = (cents: number) => Math.floor((cents * scale) / 100);
  const lineWins: LineWin[] = [];

  for (let line = 0; line < p.lines; line++) {
    const cells = PAYLINES[line].map((row, reel) => grid[reel][row]);
    const lead = cells[0];
    if (lead === "W" || lead === "S") continue; // cannot happen with these reel weights; kept for safety
    let count = 1;
    let wild = false;
    for (let i = 1; i < REELS; i++) {
      if (cells[i] === lead) count++;
      else if (cells[i] === "W") {
        count++;
        wild = true;
      } else break;
    }
    if (count < 3) continue;
    const multiplier = (wild ? WILD_MULTIPLIER : 1) * bonus;
    const payout = scaled(PAYTABLE[lead][count - 3] * p.lineBet * multiplier);
    lineWins.push({ line, symbol: lead, count, wild, multiplier, payout });
  }

  const positions: [number, number][] = [];
  grid.forEach((col, reel) => col.forEach((s, row) => s === "S" && positions.push([reel, row])));
  const n = Math.min(positions.length, 5);
  const scatter: ScatterResult = {
    count: positions.length,
    positions,
    payout: n >= 3 ? scaled(SCATTER_PAY[n - 3] * totalBet(p) * bonus) : 0,
    freeSpins: n >= 3 ? FREE_SPINS_AWARD[n - 3] : 0,
  };

  const payout = lineWins.reduce((a, w) => a + w.payout, 0) + scatter.payout;
  return { grid, lineWins, scatter, payout };
}

export function spin(rng: Rng, p: SpinParams): SpinEvaluation {
  return evaluate(drawGrid(rng), p);
}

/** Free spins remaining after a spin, honouring the retrigger cap. */
export function nextFreeSpins(remainingBefore: number, wasFreeSpin: boolean, awarded: number) {
  const left = remainingBefore - (wasFreeSpin ? 1 : 0) + awarded;
  return Math.max(0, Math.min(MAX_FREE_SPINS, left));
}

/* ------------------------------------------------------------------ */
/* Progressive jackpot (jackpot-category games only)                   */
/* ------------------------------------------------------------------ */

/** Share of every paid stake added to the progressive pool. */
export const JACKPOT_CONTRIBUTION = 0.01;

export const jackpotContribution = (stake: number) => Math.floor(stake * JACKPOT_CONTRIBUTION);

/**
 * Mystery-jackpot draw. Win probability = contribution / pool, so the expected jackpot
 * payout per spin equals what that spin paid into the pool: the jackpot is funded by
 * play, never by the engine's base RTP. Resolution is 1e-9.
 */
export function jackpotHit(rng: Rng, stake: number, pool: number) {
  if (pool <= 0) return false;
  const p = jackpotContribution(stake) / pool;
  const SCALE = 1_000_000_000;
  return rng.int(SCALE) < Math.floor(p * SCALE);
}

/** Bet-per-line steps offered in the UI, in cents. Filtered so the total stays inside the game's limits. */
export const LINE_BET_STEPS = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];

export function lineBetsFor(minTotal: number, maxTotal: number, lines: number) {
  return LINE_BET_STEPS.filter((b) => b * lines >= minTotal && b * lines <= maxTotal);
}
