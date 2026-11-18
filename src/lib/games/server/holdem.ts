import "server-only";
import type { GameRound } from "@prisma/client";
import { prisma } from "../../db";
import { secureRng } from "../rng";
import { BOT_ROSTER, runBots } from "../holdem/ai";
import { applyMove, IllegalMove, newHand, viewOf, type HoldemState, type HoldemView, type Move } from "../holdem/game";
import { fail, ok, playContext, roundContext, type Played } from "./context";
import { parseConfig } from "../config";
import { advanceRound, findActive, findByRequest, GameFailure, loadForAction, openRound, parseState, type Money } from "./rounds";

export type { HoldemView };

/** The player always sits in seat 0; AI opponents fill the rest. */
const HUMAN = 0;

/** Money for the player's seat between two states: new chips committed, plus winnings once the hand ends. */
function moneyBetween(before: HoldemState | null, after: HoldemState): Money[] {
  const prev = before ? before.seats[HUMAN].committed : 0;
  const added = after.seats[HUMAN].committed - prev;
  const money: Money[] = [];
  if (added > 0) money.push({ kind: "stake", amount: added });
  if (after.finished) {
    const won = after.winners.filter((w) => w.seat === HUMAN).reduce((a, w) => a + w.amount, 0);
    if (won > 0) money.push({ kind: "return", amount: won, stake: after.seats[HUMAN].committed, note: after.winners.find((w) => w.seat === HUMAN)?.hand ?? "Pot" });
  }
  return money;
}

const viewOfRound = (r: GameRound) => viewOf(parseState<HoldemState>(r), HUMAN);

export async function holdemStart(input: { gameId: string; requestId: string }): Promise<Played<HoldemView>> {
  let walletId: string | undefined;
  let active: GameRound | null = null;
  try {
    const { move, game, userId } = await playContext(input.gameId, "holdem", input.requestId);
    walletId = move.walletId;

    const replay = await findByRequest(userId, input.requestId, "holdem", game.id);
    if (replay) return ok(replay, viewOfRound(replay), walletId, true);

    active = await findActive(userId, game.id, "holdem");
    if (active) throw new GameFailure("active");

    const { opponents } = parseConfig("holdem", game.config);
    const bots = BOT_ROSTER.slice(0, Math.min(Math.max(opponents, 1), BOT_ROSTER.length));
    const seats = [{ name: "You", human: true, personality: null }, ...bots.map((b) => ({ name: b.name, human: false, personality: b.personality }))];

    // The button moves one seat per hand at this table.
    const last = await prisma.gameRound.findFirst({ where: { userId, gameId: game.id, engine: "holdem" }, orderBy: { createdAt: "desc" }, select: { state: true } });
    const button = last ? ((JSON.parse(last.state) as HoldemState).button + 1) % seats.length : secureRng.int(seats.length);

    const bigBlind = game.minBet % 2 === 0 ? game.minBet : game.minBet + 1;
    // Bots act (with the CSPRNG) up to the player's first decision. CPU work happens before the transaction.
    const state = runBots(newHand(secureRng, seats, button, bigBlind), secureRng);
    const round = await openRound(move, "holdem", state, state.finished, moneyBetween(null, state), { exclusive: true });
    return ok(round, viewOfRound(round), walletId);
  } catch (e) {
    return fail(e, { round: active, view: active ? viewOfRound(active) : undefined, walletId });
  }
}

export async function holdemAct(input: { roundId: string; version: number; move: Move; requestId: string }): Promise<Played<HoldemView>> {
  let walletId: string | undefined;
  let round: GameRound | null = null;
  try {
    const { move, userId } = await roundContext(input.roundId, "holdem", input.requestId);
    walletId = move.walletId;
    const loaded = await loadForAction(userId, input.roundId, "holdem", input.version, input.requestId);
    round = loaded.round;
    if (loaded.mode === "replay") return ok(round, viewOfRound(round), walletId, true);
    if (loaded.mode === "stale") throw new GameFailure("stale");

    const s = parseState<HoldemState>(round);
    if (s.toAct !== HUMAN) throw new GameFailure("illegal");
    let next: HoldemState;
    try {
      next = runBots(applyMove(s, input.move), secureRng);
    } catch (e) {
      if (e instanceof IllegalMove) throw new GameFailure("illegal");
      throw e;
    }
    const saved = await advanceRound(round, move, next, next.finished, moneyBetween(s, next));
    return ok(saved, viewOfRound(saved), walletId);
  } catch (e) {
    return fail(e, { round, view: round ? viewOfRound(round) : undefined, walletId });
  }
}

export async function activeHoldemRound(userId: string, gameId: string) {
  const r = await findActive(userId, gameId, "holdem");
  return r ? { roundId: r.id, version: r.version, view: viewOfRound(r) } : null;
}
