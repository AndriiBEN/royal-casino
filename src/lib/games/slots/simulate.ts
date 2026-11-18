import type { Rng } from "../rng";
import { nextFreeSpins, spin, totalBet } from "./engine";

export type SlotStats = {
  spins: number;
  rtp: number;
  hitRate: number;
  bonusRate: number;
  baseRtp: number;
  bonusRtp: number;
};

/** Monte Carlo RTP: plays `spins` paid spins, each followed by any free spins it triggers. */
export function simulateSlots(rng: Rng, spins: number, lines = 20, lineBet = 10, payScale = 100): SlotStats {
  let staked = 0;
  let base = 0;
  let bonus = 0;
  let hits = 0;
  let bonuses = 0;
  for (let i = 0; i < spins; i++) {
    const p = { lineBet, lines, freeSpin: false, payScale };
    staked += totalBet(p);
    const r = spin(rng, p);
    base += r.payout;
    if (r.payout > 0) hits++;
    let free = nextFreeSpins(0, false, r.scatter.freeSpins);
    if (free > 0) bonuses++;
    while (free > 0) {
      const f = spin(rng, { lineBet, lines, freeSpin: true, payScale });
      bonus += f.payout;
      free = nextFreeSpins(free, true, f.scatter.freeSpins);
    }
  }
  return {
    spins,
    rtp: (base + bonus) / staked,
    hitRate: hits / spins,
    bonusRate: bonuses / spins,
    baseRtp: base / staked,
    bonusRtp: bonus / staked,
  };
}
