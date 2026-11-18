/** Wallet limits, in credit cents. Shared by the server (enforcement) and the UI (hints). */

/** Hard ceiling on any wallet balance. Keeps every value well inside a 32-bit Int column. */
export const MAX_BALANCE = 10_000_000_00;

/** Largest single ledger movement the service will accept. */
export const MAX_ENTRY = 10_000_000_00;

export const DEPOSIT_MIN = 100_00;
export const DEPOSIT_MAX = 25_000_00;
/** Demo deposits (pending + completed) allowed per rolling 24 hours. */
export const DEPOSIT_DAILY_CAP = 100_000_00;
/** Open (pending) demo deposits allowed at once. */
export const DEPOSIT_MAX_PENDING = 3;
/** A pending demo deposit expires if not confirmed in this window. */
export const DEPOSIT_TTL_MS = 30 * 60_000;

/** Preset amounts on the deposit form, in whole credits. */
export const DEPOSIT_PRESETS = [500, 1_000, 5_000, 10_000, 25_000] as const;

export const TX_TYPES = ["signup", "bonus", "deposit", "bet", "win", "refund", "adjustment"] as const;
export type TxType = (typeof TX_TYPES)[number];

export const TX_STATUSES = ["pending", "completed", "failed", "cancelled", "expired"] as const;
export type TxStatus = (typeof TX_STATUSES)[number];
