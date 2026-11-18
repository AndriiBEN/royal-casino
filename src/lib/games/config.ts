import { z } from "zod";
import { PAY_SCALE_MAX, PAY_SCALE_MIN } from "./slots/engine";
import type { BlackjackRules } from "./blackjack/engine";

/**
 * Per-game configuration an administrator can change, validated with Zod.
 * Payout options are a fixed menu of rules, so the published RTP is always derived from
 * measured values below, never typed in by hand.
 */

export const slotsConfigSchema = z.object({
  /** percent applied to every pay; 100 = the standard paytable */
  payScale: z.number().int().min(PAY_SCALE_MIN).max(PAY_SCALE_MAX).default(100),
});
export const blackjackConfigSchema = z.object({
  blackjackPays: z.enum(["3:2", "6:5"]).default("3:2"),
  dealerHitsSoft17: z.boolean().default(false),
});
export const rouletteConfigSchema = z.object({
  laPartage: z.boolean().default(false),
});
export const holdemConfigSchema = z.object({
  opponents: z.number().int().min(1).max(5).default(3),
});

export const CONFIG_SCHEMAS = {
  slots: slotsConfigSchema,
  blackjack: blackjackConfigSchema,
  roulette: rouletteConfigSchema,
  holdem: holdemConfigSchema,
} as const;

export type Engine = keyof typeof CONFIG_SCHEMAS;
export type SlotsConfig = z.infer<typeof slotsConfigSchema>;
export type BlackjackConfig = z.infer<typeof blackjackConfigSchema>;
export type RouletteConfig = z.infer<typeof rouletteConfigSchema>;
export type HoldemConfig = z.infer<typeof holdemConfigSchema>;

/** Parses a stored config, falling back to defaults for anything missing or invalid. */
export function parseConfig<E extends Engine>(engine: E, json: string | null | undefined): z.infer<(typeof CONFIG_SCHEMAS)[E]> {
  const schema = CONFIG_SCHEMAS[engine];
  let raw: unknown = {};
  try {
    raw = json ? JSON.parse(json) : {};
  } catch {
    raw = {};
  }
  const parsed = schema.safeParse(raw);
  return (parsed.success ? parsed.data : schema.parse({})) as z.infer<(typeof CONFIG_SCHEMAS)[E]>;
}

/* ------------------------------------------------------------------ */
/* Published RTP, from simulation (see tests and npm run sim:rtp)      */
/* ------------------------------------------------------------------ */

/** Slots RTP at payScale 100, free spins included (4M-spin simulation). */
export const SLOTS_BASE_RTP = 95.6;
/** Extra return on jackpot games: 1% of every stake funds the progressive pool. */
export const JACKPOT_RTP = 1.0;

/** Blackjack with basic strategy, 6 decks, no split (6M+ hands per rule set). */
const BLACKJACK_RTP: Record<string, number> = {
  "3:2/S17": 99.1,
  "3:2/H17": 98.8,
  "6:5/S17": 97.6,
  "6:5/H17": 97.5,
};

export function blackjackRtp(r: BlackjackRules) {
  return BLACKJACK_RTP[`${r.blackjackPays}/${r.dealerHitsSoft17 ? "H17" : "S17"}`];
}

/** RTP to publish for a game with this engine and config. Hold'em has none (no rake): 0. */
export function publishedRtp(engine: string, json: string | null | undefined, isJackpot = false): number {
  switch (engine) {
    case "slots": {
      const c = parseConfig("slots", json);
      return Math.round((SLOTS_BASE_RTP * c.payScale) / 10) / 10 + (isJackpot ? JACKPOT_RTP : 0);
    }
    case "blackjack":
      return blackjackRtp(parseConfig("blackjack", json));
    case "roulette":
      // Every bet is 36/37. La Partage lifts even-money bets to 98.65%; we publish the base figure.
      return 97.3;
    default:
      return 0;
  }
}

/** One-line description of the payout settings, for the admin list and rules panels. */
export function describeConfig(engine: string, json: string | null | undefined): string {
  switch (engine) {
    case "slots":
      return `Pay scale ${parseConfig("slots", json).payScale}%`;
    case "blackjack": {
      const c = parseConfig("blackjack", json);
      return `Blackjack pays ${c.blackjackPays} · dealer ${c.dealerHitsSoft17 ? "hits" : "stands on"} soft 17`;
    }
    case "roulette":
      return parseConfig("roulette", json).laPartage ? "La Partage on" : "Standard single zero";
    case "holdem": {
      const n = parseConfig("holdem", json).opponents;
      return `${n} AI ${n === 1 ? "opponent" : "opponents"}`;
    }
    default:
      return "";
  }
}
