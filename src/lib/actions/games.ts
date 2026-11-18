"use server";

import { z } from "zod";
import { requestIdSchema } from "../validations";
import { GAME_ERROR_TEXT } from "../games/server/rounds";
import type { Played } from "../games/server/context";
import { slotsFreeSpin, slotsSpin, type SlotsView } from "../games/server/slots";
import { blackjackAct, blackjackDeal, type BlackjackView } from "../games/server/blackjack";
import { rouletteSpin, type RouletteView } from "../games/server/roulette";
import { holdemAct, holdemStart, type HoldemView } from "../games/server/holdem";
import { MAX_LINES } from "../games/slots/engine";

/*
 * Game actions. The browser sends intents only: stake sizes, a move, bet positions.
 * It never sends a result, a balance or a payout; those come from the server engines.
 * Every request carries a request id (duplicate protection) and, for multi-step rounds,
 * the round version it is acting on (stale-move protection).
 */

const id = z.string().min(1).max(40);
const cents = z.number().int().positive().max(10_000_000);
const version = z.number().int().min(0).max(1_000_000);

const invalid = { ok: false as const, error: "invalid" as const, message: GAME_ERROR_TEXT.invalid };

/* Slots */

const slotsSpinSchema = z.object({ gameId: id, lineBet: cents, lines: z.number().int().min(1).max(MAX_LINES), requestId: requestIdSchema });
const roundActionSchema = z.object({ roundId: id, version, requestId: requestIdSchema });

export async function spinSlots(input: z.input<typeof slotsSpinSchema>): Promise<Played<SlotsView>> {
  const p = slotsSpinSchema.safeParse(input);
  return p.success ? slotsSpin(p.data) : invalid;
}

export async function playFreeSpin(input: z.input<typeof roundActionSchema>): Promise<Played<SlotsView>> {
  const p = roundActionSchema.safeParse(input);
  return p.success ? slotsFreeSpin(p.data) : invalid;
}

/* Blackjack */

const dealSchema = z.object({ gameId: id, bet: cents, requestId: requestIdSchema });
const blackjackActSchema = roundActionSchema.extend({ action: z.enum(["hit", "stand", "double"]) });

export async function dealBlackjack(input: z.input<typeof dealSchema>): Promise<Played<BlackjackView>> {
  const p = dealSchema.safeParse(input);
  return p.success ? blackjackDeal(p.data) : invalid;
}

export async function actBlackjack(input: z.input<typeof blackjackActSchema>): Promise<Played<BlackjackView>> {
  const p = blackjackActSchema.safeParse(input);
  return p.success ? blackjackAct(p.data) : invalid;
}

/* Roulette */

const rouletteBetSchema = z.object({
  kind: z.enum(["straight", "red", "black", "odd", "even", "low", "high", "dozen", "column"]),
  value: z.number().int().min(0).max(36).optional(),
  amount: cents,
});
const rouletteSchema = z.object({ gameId: id, bets: z.array(rouletteBetSchema).min(1).max(160), requestId: requestIdSchema });

export async function spinRoulette(input: z.input<typeof rouletteSchema>): Promise<Played<RouletteView>> {
  const p = rouletteSchema.safeParse(input);
  return p.success ? rouletteSpin(p.data) : invalid;
}

/* Texas Hold'em */

const holdemStartSchema = z.object({ gameId: id, requestId: requestIdSchema });
const holdemActSchema = roundActionSchema.extend({ move: z.enum(["fold", "check", "call", "bet", "raise"]) });

export async function startHoldem(input: z.input<typeof holdemStartSchema>): Promise<Played<HoldemView>> {
  const p = holdemStartSchema.safeParse(input);
  return p.success ? holdemStart(p.data) : invalid;
}

export async function actHoldem(input: z.input<typeof holdemActSchema>): Promise<Played<HoldemView>> {
  const p = holdemActSchema.safeParse(input);
  return p.success ? holdemAct(p.data) : invalid;
}
