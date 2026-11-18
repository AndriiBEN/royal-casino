import "server-only";
import type { Game, GameRound } from "@prisma/client";
import { prisma } from "../../db";
import { secureRng } from "../rng";
import {
  jackpotContribution,
  jackpotHit,
  nextFreeSpins,
  spin,
  totalBet,
  validateParams,
  type SpinEvaluation,
} from "../slots/engine";
import { fail, ok, playContext, roundContext, type Played } from "./context";
import { parseConfig } from "../config";
import { advanceRound, findActive, findByRequest, GameFailure, loadForAction, openRound, parseState, type Money } from "./rounds";

type SlotsState = {
  lineBet: number;
  /** pay scale at the time of the paid spin; free spins keep it */
  payScale?: number;
  lines: number;
  /** free spins still to play */
  freeSpinsLeft: number;
  /** free spins played in this bonus round */
  freeSpinsPlayed: number;
  /** total won during this round's free spins */
  bonusWin: number;
  wasFreeSpin: boolean;
  last: SpinEvaluation;
  jackpotWon: number | null;
};

export type SlotsView = {
  lineBet: number;
  lines: number;
  totalBet: number;
  spin: Pick<SpinEvaluation, "grid" | "lineWins" | "scatter" | "payout">;
  wasFreeSpin: boolean;
  freeSpinsLeft: number;
  freeSpinsPlayed: number;
  bonusWin: number;
  inBonus: boolean;
  jackpotWon: number | null;
  /** current progressive pool for jackpot games */
  jackpot: number | null;
};

const view = (s: SlotsState, game: Pick<Game, "jackpot">): SlotsView => ({
  lineBet: s.lineBet,
  lines: s.lines,
  totalBet: s.lineBet * s.lines,
  spin: { grid: s.last.grid, lineWins: s.last.lineWins, scatter: s.last.scatter, payout: s.last.payout },
  wasFreeSpin: s.wasFreeSpin,
  freeSpinsLeft: s.freeSpinsLeft,
  freeSpinsPlayed: s.freeSpinsPlayed,
  bonusWin: s.bonusWin,
  inBonus: s.freeSpinsLeft > 0,
  jackpotWon: s.jackpotWon,
  jackpot: game.jackpot,
});

async function currentJackpot(gameId: string) {
  return (await prisma.game.findUnique({ where: { id: gameId }, select: { jackpot: true } }))?.jackpot ?? null;
}

const viewOfRound = async (round: GameRound) => view(parseState<SlotsState>(round), { jackpot: await currentJackpot(round.gameId) });

/** A paid spin. If it triggers free spins, the round stays active until they are played. */
export async function slotsSpin(input: { gameId: string; lineBet: number; lines: number; requestId: string }): Promise<Played<SlotsView>> {
  let walletId: string | undefined;
  let active: GameRound | null = null;
  try {
    const { move, game, userId } = await playContext(input.gameId, "slots", input.requestId);
    walletId = move.walletId;

    const replay = await findByRequest(userId, input.requestId, "slots", game.id);
    if (replay) return ok(replay, await viewOfRound(replay), walletId, true);

    // Free spins already won must be played before another paid spin.
    active = await findActive(userId, game.id, "slots");
    if (active) throw new GameFailure("active");

    const params = { lineBet: input.lineBet, lines: input.lines };
    if (!validateParams(params)) throw new GameFailure("invalid");
    const stake = totalBet(params);
    if (stake < game.minBet || stake > game.maxBet) throw new GameFailure("limits");

    const { payScale } = parseConfig("slots", game.config);
    const result = spin(secureRng, { ...params, freeSpin: false, payScale });
    const freeSpinsLeft = nextFreeSpins(0, false, result.scatter.freeSpins);
    const state: SlotsState = { ...params, payScale, freeSpinsLeft, freeSpinsPlayed: 0, bonusWin: 0, wasFreeSpin: false, last: result, jackpotWon: null };
    const money: Money[] = [{ kind: "stake", amount: stake }];
    if (result.payout > 0) money.push({ kind: "return", amount: result.payout, stake });

    const isJackpot = game.category === "jackpots" && game.jackpot !== null;
    const round = await openRound(move, "slots", state, freeSpinsLeft === 0, money, {
      // Progressive pool: fund it with this stake, then draw for it, in the same transaction.
      beforeMoney: isJackpot
        ? async (db, roundId) => {
            const g = await db.game.update({
              where: { id: game.id },
              data: { jackpot: { increment: jackpotContribution(stake) } },
              select: { jackpot: true, jackpotSeed: true },
            });
            if (!jackpotHit(secureRng, stake, g.jackpot ?? 0)) return [];
            const won = g.jackpot!;
            await db.game.update({ where: { id: game.id }, data: { jackpot: g.jackpotSeed ?? 0 } });
            await db.gameRound.update({ where: { id: roundId }, data: { state: JSON.stringify({ ...state, jackpotWon: won }) } });
            return [{ kind: "return", amount: won, stake, note: "Progressive jackpot" }];
          }
        : undefined,
    });
    return ok(round, await viewOfRound(round), walletId);
  } catch (e) {
    return fail(e, { round: active, view: active ? await viewOfRound(active) : undefined, walletId });
  }
}

/** Plays the next free spin of an active bonus round. Costs nothing; wins pay at x3. */
export async function slotsFreeSpin(input: { roundId: string; version: number; requestId: string }): Promise<Played<SlotsView>> {
  let walletId: string | undefined;
  let round: GameRound | null = null;
  try {
    const { move, userId } = await roundContext(input.roundId, "slots", input.requestId);
    walletId = move.walletId;
    const loaded = await loadForAction(userId, input.roundId, "slots", input.version, input.requestId);
    round = loaded.round;
    if (loaded.mode === "replay") return ok(round, await viewOfRound(round), walletId, true);
    if (loaded.mode === "stale") throw new GameFailure("stale");

    const s = parseState<SlotsState>(round);
    if (s.freeSpinsLeft <= 0) throw new GameFailure("illegal");
    const result = spin(secureRng, { lineBet: s.lineBet, lines: s.lines, freeSpin: true, payScale: s.payScale ?? 100 });
    const left = nextFreeSpins(s.freeSpinsLeft, true, result.scatter.freeSpins);
    const next: SlotsState = {
      ...s,
      freeSpinsLeft: left,
      freeSpinsPlayed: s.freeSpinsPlayed + 1,
      bonusWin: s.bonusWin + result.payout,
      wasFreeSpin: true,
      last: result,
      jackpotWon: null,
    };
    const money: Money[] = result.payout > 0 ? [{ kind: "return", amount: result.payout, stake: totalBet(s), note: "Free spin" }] : [];
    const saved = await advanceRound(round, move, next, left === 0, money);
    return ok(saved, await viewOfRound(saved), walletId);
  } catch (e) {
    return fail(e, { round, view: round ? await viewOfRound(round) : undefined, walletId });
  }
}

/** The player's unfinished bonus round for this game, if any (shown on page load). */
export async function activeSlotsRound(userId: string, gameId: string) {
  const r = await findActive(userId, gameId, "slots");
  return r ? { roundId: r.id, version: r.version, view: await viewOfRound(r) } : null;
}

