import { randomInt } from "node:crypto";

/**
 * Random source used by every game engine. Engines never call Math.random: production
 * uses the operating system's CSPRNG through node:crypto, and tests inject a seeded
 * or scripted source so outcomes are reproducible.
 */
export interface Rng {
  /** Uniform integer in [0, max). */
  int(max: number): number;
}

export const secureRng: Rng = {
  int(max) {
    if (!Number.isSafeInteger(max) || max <= 0) throw new RangeError(`Invalid RNG bound: ${max}`);
    return max === 1 ? 0 : randomInt(max);
  },
};

/** Deterministic PRNG (mulberry32) for tests and simulations. Never used for real play. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return {
    int(max) {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      const r = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      return Math.floor(r * max);
    },
  };
}

/** Unbiased Fisher-Yates shuffle (returns a new array). */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
