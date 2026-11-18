/**
 * Monte Carlo return-to-player check for the slots, blackjack and roulette engines.
 * Usage: npm run sim:rtp [-- <rounds>]   (default 1,000,000 per game)
 *
 * Uses the same engines as live play with the production CSPRNG.
 * Hold'em has no house edge (no rake; you play against the AI table), so it is not listed.
 */
import { secureRng } from "../src/lib/games/rng";
import { simulateSlots } from "../src/lib/games/slots/simulate";
import { act, deal } from "../src/lib/games/blackjack/engine";
import { basicStrategy } from "../src/lib/games/blackjack/strategy";
import { spin } from "../src/lib/games/roulette/engine";

const n = Number(process.argv[2] ?? 1_000_000);
const pct = (x: number) => `${(x * 100).toFixed(2)}%`;

const slots = simulateSlots(secureRng, n);
console.log(`Slots     ${n.toLocaleString()} paid spins (20 lines)`);
console.log(`  RTP ${pct(slots.rtp)}  (base ${pct(slots.baseRtp)} + free spins ${pct(slots.bonusRtp)})`);
console.log(`  hit rate ${pct(slots.hitRate)}, bonus 1 in ${Math.round(1 / slots.bonusRate)} spins`);
console.log(`  jackpot games add the 1% progressive contribution on top\n`);

let staked = 0;
let returned = 0;
for (let i = 0; i < n; i++) {
  let s = deal(secureRng, 100);
  while (s.phase === "player") s = act(s, basicStrategy(s));
  staked += 100;
  returned += s.returned - (s.bet - 100); // per initial bet: a double's extra stake is part of the result
}
console.log(`Blackjack ${n.toLocaleString()} rounds, basic strategy`);
console.log(`  RTP ${pct(returned / staked)} per initial bet\n`);

let rStaked = 0;
let rReturned = 0;
for (let i = 0; i < n; i++) {
  const r = spin(secureRng, [{ kind: "red", amount: 100 }]);
  rStaked += 100;
  rReturned += r.returned;
}
console.log(`Roulette  ${n.toLocaleString()} spins on red`);
console.log(`  RTP ${pct(rReturned / rStaked)} (theory 97.30%)`);
