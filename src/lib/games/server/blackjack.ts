import "server-only";
import type { GameRound } from "@prisma/client";
import { secureRng } from "../rng";
import { act, deal, IllegalMove, viewOf, type Action, type BlackjackState, type BlackjackView } from "../blackjack/engine";
import { fail, ok, playContext, roundContext, type Played } from "./context";
import { parseConfig } from "../config";
import { advanceRound, findActive, findByRequest, GameFailure, loadForAction, openRound, parseState, type Money } from "./rounds";

export type { BlackjackView };

/** Money owed when a round settles: the whole return, as a win, or as a refund on a push. */
function settlement(s: BlackjackState): Money[] {
  if (s.phase !== "settled" || s.returned <= 0) return [];
  return [{ kind: "return", amount: s.returned, stake: s.bet, type: s.outcome === "push" ? "refund" : "win", note: s.outcome === "push" ? "Push" : undefined }];
}

const viewOfRound = (r: GameRound) => viewOf(parseState<BlackjackState>(r));

export async function blackjackDeal(input: { gameId: string; bet: number; requestId: string }): Promise<Played<BlackjackView>> {
  let walletId: string | undefined;
  let active: GameRound | null = null;
  try {
    const { move, game, userId } = await playContext(input.gameId, "blackjack", input.requestId);
    walletId = move.walletId;

    const replay = await findByRequest(userId, input.requestId, "blackjack", game.id);
    if (replay) return ok(replay, viewOfRound(replay), walletId, true);

    active = await findActive(userId, game.id, "blackjack");
    if (active) throw new GameFailure("active");

    if (!Number.isSafeInteger(input.bet) || input.bet < game.minBet || input.bet > game.maxBet) throw new GameFailure("limits");

    // The table's rules are copied onto the round, so a later config change never alters a hand in play.
    const state = deal(secureRng, input.bet, undefined, parseConfig("blackjack", game.config));
    const settled = state.phase === "settled";
    const round = await openRound(move, "blackjack", state, settled, [{ kind: "stake", amount: input.bet }, ...settlement(state)], { exclusive: true });
    return ok(round, viewOfRound(round), walletId);
  } catch (e) {
    return fail(e, { round: active, view: active ? viewOfRound(active) : undefined, walletId });
  }
}

export async function blackjackAct(input: { roundId: string; version: number; action: Action; requestId: string }): Promise<Played<BlackjackView>> {
  let walletId: string | undefined;
  let round: GameRound | null = null;
  try {
    const { move, userId } = await roundContext(input.roundId, "blackjack", input.requestId);
    walletId = move.walletId;
    const loaded = await loadForAction(userId, input.roundId, "blackjack", input.version, input.requestId);
    round = loaded.round;
    if (loaded.mode === "replay") return ok(round, viewOfRound(round), walletId, true);
    if (loaded.mode === "stale") throw new GameFailure("stale");

    const s = parseState<BlackjackState>(round);
    let next: BlackjackState;
    try {
      next = act(s, input.action);
    } catch (e) {
      if (e instanceof IllegalMove) throw new GameFailure("illegal");
      throw e;
    }
    // Doubling stakes the original bet again; the debit fails (and nothing changes) without funds.
    const money: Money[] = input.action === "double" ? [{ kind: "stake", amount: s.bet, note: "Double down" }] : [];
    money.push(...settlement(next));
    const saved = await advanceRound(round, move, next, next.phase === "settled", money);
    return ok(saved, viewOfRound(saved), walletId);
  } catch (e) {
    return fail(e, { round, view: round ? viewOfRound(round) : undefined, walletId });
  }
}

export async function activeBlackjackRound(userId: string, gameId: string) {
  const r = await findActive(userId, gameId, "blackjack");
  return r ? { roundId: r.id, version: r.version, view: viewOfRound(r) } : null;
}
