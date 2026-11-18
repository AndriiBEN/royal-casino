import "server-only";
import type { Game, GameRound } from "@prisma/client";
import { prisma } from "../../db";
import { getCurrentUser, touchSession } from "../../auth";
import { hit, LIMITS } from "../../rate-limit";
import { requestContext, type AuditContext } from "../../wallet/service";
import { GAME_ERROR_TEXT, GameFailure, type GameError, type Move } from "./rounds";

export type Engine = "slots" | "blackjack" | "roulette" | "holdem";

/** What every game action returns to the browser. Amounts are cents; `balance` is always read from the database. */
export type Played<V> =
  | { ok: true; roundId: string; version: number; view: V; balance: number; replay?: boolean }
  | { ok: false; error: GameError; message: string; roundId?: string; version?: number; view?: V; balance?: number };

export type PlayContext = { move: Move; game: Game; userId: string };

type Player = { userId: string; walletId: string; ctx: AuditContext };
type Resolver = () => Promise<Player | null>;

/** Production: the signed-in user from the session cookie. */
const sessionPlayer: Resolver = async () => {
  const user = await getCurrentUser();
  if (!user?.wallet) return null;
  await touchSession();
  return { userId: user.id, walletId: user.wallet.id, ctx: await requestContext(user.id) };
};

let resolvePlayer: Resolver = sessionPlayer;

/** Integration tests only: act as a given user without a cookie. Refuses outside NODE_ENV=test. */
export function setPlayerForTests(player: Player | null) {
  if (process.env.NODE_ENV !== "test") throw new Error("setPlayerForTests is only available in tests");
  resolvePlayer = player ? async () => player : sessionPlayer;
}

/**
 * Authenticates, rate-limits and resolves the game for an action. Disabled games cannot
 * start new rounds; actions on a round already in progress are still allowed to finish it.
 */
export async function playContext(gameId: string, engine: Engine, requestId: string, opts: { allowDisabled?: boolean } = {}): Promise<PlayContext> {
  const player = await resolvePlayer();
  if (!player) throw new GameFailure("auth");
  if (!hit(`game:${player.userId}`, LIMITS.gameActionsPerUser).ok) throw new GameFailure("rate");
  const game = await prisma.game.findUnique({ where: { id: gameId } });
  if (!game || game.engine !== engine) throw new GameFailure("invalid");
  if (!game.enabled && !opts.allowDisabled) throw new GameFailure("disabled");
  return {
    userId: player.userId,
    game,
    move: { gameId: game.id, walletId: player.walletId, userId: player.userId, requestId, ctx: player.ctx },
  };
}

/** Same as playContext, for an action on an existing round of this user (the round decides the game). */
export async function roundContext(roundId: string, engine: Engine, requestId: string) {
  const player = await resolvePlayer();
  if (!player) throw new GameFailure("auth");
  const round = await prisma.gameRound.findFirst({ where: { id: roundId, userId: player.userId, engine }, select: { gameId: true } });
  if (!round) throw new GameFailure("not_found");
  return playContext(round.gameId, engine, requestId, { allowDisabled: true });
}

export async function balanceOf(walletId: string) {
  const w = await prisma.wallet.findUnique({ where: { id: walletId }, select: { balance: true } });
  return w?.balance ?? 0;
}

export async function ok<V>(round: GameRound, view: V, walletId: string, replay = false): Promise<Played<V>> {
  return { ok: true, roundId: round.id, version: round.version, view, balance: await balanceOf(walletId), replay: replay || undefined };
}

/** Converts failures to a typed response, attaching the round's current view when there is one. */
export async function fail<V>(e: unknown, extra?: { round?: GameRound | null; view?: V; walletId?: string }): Promise<Played<V>> {
  if (!(e instanceof GameFailure)) throw e;
  return {
    ok: false,
    error: e.code,
    message: GAME_ERROR_TEXT[e.code],
    roundId: extra?.round?.id,
    version: extra?.round?.version,
    view: extra?.view,
    balance: extra?.walletId ? await balanceOf(extra.walletId) : undefined,
  };
}
