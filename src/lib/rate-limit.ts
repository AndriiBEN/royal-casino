import "server-only";
export { clientIp } from "./client-ip";

/**
 * Fixed-window rate limiter held in process memory.
 * Royal Casino runs as a single local Node process, so memory is sufficient; a
 * multi-instance deployment would swap this for a shared store such as Redis.
 */
type Bucket = { count: number; resetAt: number };

const globalForLimits = globalThis as unknown as { __rcRateLimits?: Map<string, Bucket> };
const buckets = (globalForLimits.__rcRateLimits ??= new Map());

export type Limit = { limit: number; windowMs: number };

export const LIMITS = {
  loginPerIp: { limit: 20, windowMs: 15 * 60_000 },
  loginPerAccount: { limit: 5, windowMs: 15 * 60_000 },
  registerPerIp: { limit: 5, windowMs: 60 * 60_000 },
  passwordChangePerUser: { limit: 5, windowMs: 15 * 60_000 },
  depositPerUser: { limit: 10, windowMs: 10 * 60_000 },
  walletActionPerUser: { limit: 60, windowMs: 10 * 60_000 },
  /** every game request (spins, deals, moves); generous for normal play, stops scripted floods */
  gameActionsPerUser: { limit: 240, windowMs: 60_000 },
} satisfies Record<string, Limit>;

export type RateResult = { ok: true; remaining: number } | { ok: false; retryAfterMs: number };

/** Counts one attempt against `key`. */
export function hit(key: string, { limit, windowMs }: Limit): RateResult {
  const now = Date.now();
  sweep(now);
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1 };
  }
  if (b.count >= limit) return { ok: false, retryAfterMs: b.resetAt - now };
  b.count++;
  return { ok: true, remaining: limit - b.count };
}

/** Clears a key, e.g. per-account login failures after a successful login. */
export function reset(key: string) {
  buckets.delete(key);
}

let lastSweep = 0;
function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
}

export function retryMessage(ms: number) {
  const mins = Math.ceil(ms / 60_000);
  return `Too many attempts. Please try again in ${mins} minute${mins === 1 ? "" : "s"}.`;
}
