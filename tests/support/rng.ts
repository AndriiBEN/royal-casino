import type { Rng } from "@/lib/games/rng";

/** Returns the scripted values in order (each must be < max), then fails loudly. */
export function scriptedRng(values: number[]): Rng {
  let i = 0;
  return {
    int(max) {
      if (i >= values.length) throw new Error("scriptedRng exhausted");
      const v = values[i++];
      if (v < 0 || v >= max) throw new Error(`scripted value ${v} out of range [0, ${max})`);
      return v;
    },
  };
}
