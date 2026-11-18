import "server-only";
import type { GameRound } from "@prisma/client";
import { prisma } from "../../db";
import { atomic, postEntry, WalletError, type AuditContext, type Db } from "../../wallet/service";
import { summarize } from "../summary";

/**
 * Shared server plumbing for every game.
 *
 * - The browser sends only intents (bet amounts, moves) plus a request id and, for
 *   multi-step rounds, the round version it is looking at.
 * - Engines run here, with the CSPRNG. The full engine state lives in GameRound.state
 *   and never leaves the server; clients get a derived view.
 * - A round is written with a compare-and-set on `version`, inside the same database
 *   transaction as the wallet entries. A stale or concurrent request changes nothing.
 * - Replays: a start request with a used request id returns that round, and an action
 *   whose request id was the last one applied returns the current view. Wallet entries
 *   carry the request id as their idempotency key as a second line of defence.
 */

export type GameError =
  | "auth"
  | "invalid"
  | "funds"
  | "limits"
  | "illegal"
  | "stale"
  | "not_found"
  | "active"
  | "disabled"
  | "rate";

export const GAME_ERROR_TEXT: Record<GameError, string> = {
  auth: "Your session has ended. Please log in again.",
  invalid: "That request could not be processed.",
  funds: "Not enough credits for that.",
  limits: "That stake is outside this table's limits.",
  illegal: "That move isn't allowed right now.",
  stale: "This round moved on. Showing the latest state.",
  not_found: "That round no longer exists.",
  active: "Finish the round in progress first.",
  disabled: "This game is temporarily unavailable.",
  rate: "Slow down a little and try again.",
};

export class GameFailure extends Error {
  constructor(public code: GameError) {
    super(code);
    this.name = "GameFailure";
  }
}

export type Money =
  | { kind: "stake"; amount: number; note?: string }
  | { kind: "return"; amount: number; stake: number; type?: "win" | "refund"; note?: string };

export type Move = { gameId: string; walletId: string; userId: string; requestId: string; ctx: AuditContext };

/**
 * Applies money movements for one request: stakes first (each conditional on funds),
 * then returns. Each stake earns 1 Crown Point per whole credit.
 */
export async function applyMoney(db: Db, m: Move, money: Money[]) {
  let i = 0;
  for (const x of money) {
    if (x.amount <= 0) continue;
    const key = `${m.requestId}:${i++}`;
    if (x.kind === "stake") {
      await postEntry(db, {
        walletId: m.walletId,
        type: "bet",
        amount: -x.amount,
        gameId: m.gameId,
        idempotencyKey: key,
        note: x.note ?? null,
        ctx: m.ctx,
        action: "game.bet",
      });
      const points = Math.floor(x.amount / 100);
      if (points) await db.user.update({ where: { id: m.userId }, data: { vipPoints: { increment: points } } });
    } else {
      const type = x.type ?? "win";
      await postEntry(db, {
        walletId: m.walletId,
        type,
        amount: x.amount,
        gameId: m.gameId,
        multiplier: type === "win" && x.stake > 0 ? Math.round((x.amount / x.stake) * 100) / 100 : null,
        idempotencyKey: key,
        note: x.note ?? null,
        ctx: m.ctx,
        action: type === "win" ? "game.win" : "game.refund",
      });
    }
  }
}

const sum = (money: Money[], kind: Money["kind"]) => money.filter((x) => x.kind === kind).reduce((a, x) => a + x.amount, 0);

export function toWalletFailure(e: unknown): never {
  if (e instanceof WalletError) {
    if (e.code === "funds") throw new GameFailure("funds");
    if (e.code === "duplicate") throw new GameFailure("stale");
    if (e.code === "cap") throw new GameFailure("limits");
  }
  throw e;
}

/**
 * A request id that already opened a round for this user, if any. Request ids are unique
 * per user across all games, so an id first used at another table (or another game type)
 * is refused instead of answering with that round's state.
 */
export async function findByRequest(userId: string, requestId: string, engine: string, gameId: string) {
  const round = await prisma.gameRound.findUnique({ where: { userId_requestId: { userId, requestId } } });
  if (round && (round.engine !== engine || round.gameId !== gameId)) throw new GameFailure("invalid");
  return round;
}

export function findActive(userId: string, gameId: string, engine: string) {
  return prisma.gameRound.findFirst({ where: { userId, gameId, engine, status: "active" }, orderBy: { createdAt: "desc" } });
}

/** Creates a round and applies its opening money in one transaction. */
export async function openRound<S>(
  m: Move,
  engine: string,
  state: S,
  settled: boolean,
  money: Money[],
  opts: { exclusive?: boolean; beforeMoney?: (db: Db, roundId: string) => Promise<Money[]> } = {},
): Promise<GameRound> {
  try {
    return await atomic(async (db) => {
      if (opts.exclusive) {
        // One live round per player and table (SQLite serialises writers, so this check is race-free).
        const live = await db.gameRound.count({ where: { userId: m.userId, gameId: m.gameId, engine, status: "active" } });
        if (live) throw new GameFailure("active");
      }
      const round = await db.gameRound.create({
        data: {
          userId: m.userId,
          gameId: m.gameId,
          engine,
          status: settled ? "settled" : "active",
          state: JSON.stringify(state),
          requestId: m.requestId,
          lastRequestId: m.requestId,
          settledAt: settled ? new Date() : null,
        },
      });
      const extra = opts.beforeMoney ? await opts.beforeMoney(db, round.id) : [];
      const all = [...money, ...extra];
      await applyMoney(db, m, all);
      // beforeMoney may have amended the state (e.g. a jackpot win), so summarise what is stored.
      const latest = settled ? (await db.gameRound.findUniqueOrThrow({ where: { id: round.id }, select: { state: true } })).state : null;
      return db.gameRound.update({
        where: { id: round.id },
        data: {
          staked: sum(all, "stake"),
          returned: sum(all, "return"),
          summary: latest ? JSON.stringify(summarize(engine, JSON.parse(latest))) : null,
        },
      });
    });
  } catch (e) {
    if (e instanceof GameFailure) throw e;
    // Two identical start requests racing: the unique (userId, requestId) let one through.
    const replay = await findByRequest(m.userId, m.requestId, engine, m.gameId);
    if (replay) return replay;
    return toWalletFailure(e);
  }
}

/** Saves the next state of an active round if nobody else has moved it, with its money. */
export async function advanceRound<S>(round: GameRound, m: Move, next: S, settled: boolean, money: Money[]): Promise<GameRound> {
  try {
    return await atomic(async (db) => {
      const res = await db.gameRound.updateMany({
        where: { id: round.id, version: round.version, status: "active" },
        data: {
          state: JSON.stringify(next),
          version: { increment: 1 },
          lastRequestId: m.requestId,
          status: settled ? "settled" : "active",
          settledAt: settled ? new Date() : null,
          summary: settled ? JSON.stringify(summarize(round.engine, next)) : null,
          staked: { increment: sum(money, "stake") },
          returned: { increment: sum(money, "return") },
        },
      });
      if (res.count === 0) throw new GameFailure("stale");
      await applyMoney(db, m, money);
      return db.gameRound.findUniqueOrThrow({ where: { id: round.id } });
    });
  } catch (e) {
    if (e instanceof GameFailure) throw e;
    return toWalletFailure(e);
  }
}

/**
 * Loads a round for an action and classifies the request:
 * - "replay": this exact request was already applied; answer with the current state;
 * - "stale": the client is behind (wrong version or round already settled);
 * - "apply": go ahead.
 */
export async function loadForAction(userId: string, roundId: string, engine: string, version: number, requestId: string) {
  const round = await prisma.gameRound.findFirst({ where: { id: roundId, userId, engine } });
  if (!round) throw new GameFailure("not_found");
  if (round.lastRequestId === requestId) return { round, mode: "replay" as const };
  if (round.status !== "active" || round.version !== version) return { round, mode: "stale" as const };
  return { round, mode: "apply" as const };
}

export const parseState = <S>(round: GameRound) => JSON.parse(round.state) as S;
