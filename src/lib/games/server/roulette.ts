import "server-only";
import type { GameRound } from "@prisma/client";
import { prisma } from "../../db";
import { secureRng } from "../rng";
import { betKey, isValidBet, spin, type Bet, type RouletteResult } from "../roulette/engine";
import { fail, ok, playContext, type Played } from "./context";
import { parseConfig } from "../config";
import { findByRequest, GameFailure, openRound, parseState } from "./rounds";

export type RouletteView = RouletteResult;

/** Most separate positions one spin may cover. */
export const MAX_ROULETTE_BETS = 40;

/** Validates and merges bets on the same position. Throws on anything malformed. */
export function normaliseBets(raw: Bet[]): Bet[] {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_ROULETTE_BETS * 4) throw new GameFailure("invalid");
  const merged = new Map<string, Bet>();
  for (const b of raw) {
    const bet: Bet = b.kind === "straight" || b.kind === "dozen" || b.kind === "column" ? { kind: b.kind, value: b.value, amount: b.amount } : { kind: b.kind, amount: b.amount };
    if (!isValidBet(bet)) throw new GameFailure("invalid");
    const key = betKey(bet);
    const prev = merged.get(key);
    merged.set(key, prev ? { ...prev, amount: prev.amount + bet.amount } : bet);
  }
  if (merged.size > MAX_ROULETTE_BETS) throw new GameFailure("limits");
  return [...merged.values()];
}

export async function rouletteSpin(input: { gameId: string; bets: Bet[]; requestId: string }): Promise<Played<RouletteView>> {
  let walletId: string | undefined;
  try {
    const { move, game, userId } = await playContext(input.gameId, "roulette", input.requestId);
    walletId = move.walletId;

    const replay = await findByRequest(userId, input.requestId, "roulette", game.id);
    if (replay) return ok(replay, parseState<RouletteResult>(replay), walletId, true);

    const bets = normaliseBets(input.bets);
    const staked = bets.reduce((a, b) => a + b.amount, 0);
    if (staked < game.minBet || staked > game.maxBet) throw new GameFailure("limits");
    // Each position must hold at least the table's minimum chip.
    if (bets.some((b) => b.amount < Math.max(1, Math.floor(game.minBet / 10)))) throw new GameFailure("limits");

    const result = spin(secureRng, bets, parseConfig("roulette", game.config));
    const round: GameRound = await openRound(move, "roulette", result, true, [
      { kind: "stake", amount: staked },
      ...(result.returned > 0 ? [{ kind: "return" as const, amount: result.returned, stake: staked, note: `${result.number} ${result.color}` }] : []),
    ]);
    return ok(round, parseState<RouletteResult>(round), walletId);
  } catch (e) {
    return fail(e, { walletId });
  }
}

/** Last results at this table for the player's history strip. */
export async function recentRouletteNumbers(userId: string, gameId: string, take = 14) {
  const rows = await prisma.gameRound.findMany({
    where: { userId, gameId, engine: "roulette" },
    orderBy: { createdAt: "desc" },
    take,
    select: { state: true },
  });
  return rows.map((r) => (JSON.parse(r.state) as RouletteResult).number);
}
