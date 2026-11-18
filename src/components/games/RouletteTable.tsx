"use client";

import { useMemo, useState } from "react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform, type MotionValue } from "framer-motion";
import { Eraser, RotateCcw, Undo2 } from "lucide-react";
import { spinRoulette } from "@/lib/actions/games";
import type { RouletteView } from "@/lib/games/server/roulette";
import { betKey, colorOf, ODDS, WHEEL_ORDER, type Bet, type BetKind } from "@/lib/games/roulette/engine";
import { Button } from "@/components/ui/Button";
import { cn, formatCredits } from "@/lib/utils";
import { useRound } from "./play/useRound";
import { Chip, ErrorLine, Hud, ResultBanner } from "./play/Hud";
import { playSound } from "@/lib/sound";

const CHIP_VALUES = [10, 50, 100, 500, 2_500, 10_000, 50_000];
const POCKET = 360 / 37;

const FILL = { red: "#a3132b", black: "#141416", green: "#0f6b45" } as const;

/* ------------------------------------------------------------------ */
/* Wheel                                                               */
/* ------------------------------------------------------------------ */

function Wheel({ wheelDeg, ballDeg, ballRadius }: { wheelDeg: MotionValue<number>; ballDeg: MotionValue<number>; ballRadius: MotionValue<number> }) {
  const R = 150;
  const ballX = useTransform(() => 160 + ballRadius.get() * Math.sin((ballDeg.get() * Math.PI) / 180));
  const ballY = useTransform(() => 160 - ballRadius.get() * Math.cos((ballDeg.get() * Math.PI) / 180));

  const pockets = useMemo(
    () =>
      WHEEL_ORDER.map((n, i) => {
        const a0 = ((i - 0.5) * POCKET * Math.PI) / 180;
        const a1 = ((i + 0.5) * POCKET * Math.PI) / 180;
        const outer = R;
        const inner = R - 34;
        const p = (r: number, a: number) => `${160 + r * Math.sin(a)} ${160 - r * Math.cos(a)}`;
        const mid = (i * POCKET * Math.PI) / 180;
        return {
          n,
          d: `M${p(inner, a0)} L${p(outer, a0)} A${outer} ${outer} 0 0 1 ${p(outer, a1)} L${p(inner, a1)} A${inner} ${inner} 0 0 0 ${p(inner, a0)} Z`,
          tx: 160 + (R - 15) * Math.sin(mid),
          ty: 160 - (R - 15) * Math.cos(mid),
          rot: i * POCKET,
        };
      }),
    [],
  );

  return (
    <svg viewBox="0 0 320 320" className="h-auto w-full max-w-[22rem] drop-shadow-[0_30px_40px_rgb(0_0_0/0.8)]" role="img" aria-label="European roulette wheel">
      <defs>
        <radialGradient id="rim" cx="50%" cy="50%" r="50%">
          <stop offset="80%" stopColor="#3a2a14" />
          <stop offset="100%" stopColor="#1a1208" />
        </radialGradient>
        <radialGradient id="hub" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#f1d79a" />
          <stop offset="100%" stopColor="#7a5a26" />
        </radialGradient>
      </defs>
      <circle cx="160" cy="160" r="158" fill="url(#rim)" stroke="#D4AF62" strokeWidth="2" />
      {/* Framer rotates SVG groups about their own centre: the wheel's centre (160, 160). */}
      <motion.g style={{ rotate: wheelDeg }}>
        {pockets.map((p) => (
          <g key={p.n}>
            <path d={p.d} fill={FILL[colorOf(p.n)]} stroke="#D4AF62" strokeWidth="0.6" />
            <text x={p.tx} y={p.ty} fill="#f7f1e3" fontSize="10" fontWeight={700} textAnchor="middle" dominantBaseline="central" transform={`rotate(${p.rot} ${p.tx} ${p.ty})`}>
              {p.n}
            </text>
          </g>
        ))}
        <circle cx="160" cy="160" r="114" fill="#1b140b" stroke="#D4AF62" strokeWidth="1" />
        {Array.from({ length: 8 }).map((_, i) => (
          <line key={i} x1="160" y1="160" x2={160 + 70 * Math.sin((i * Math.PI) / 4)} y2={160 - 70 * Math.cos((i * Math.PI) / 4)} stroke="#b89550" strokeWidth="4" strokeLinecap="round" />
        ))}
        <circle cx="160" cy="160" r="22" fill="url(#hub)" stroke="#f7e3b0" strokeWidth="1" />
      </motion.g>
      {/* pointer */}
      <path d="M160 4 l-7 -2 l7 16 l7 -16 z" fill="#D4AF62" />
      {/* ball */}
      <motion.circle cx={ballX} cy={ballY} r="6.5" fill="#fbf7ee" stroke="#9a8b6a" strokeWidth="0.8" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Board                                                               */
/* ------------------------------------------------------------------ */

type Spot = { kind: BetKind; value?: number; label: string };

const ROWS_TOP_DOWN = [3, 2, 1].map((r) => Array.from({ length: 12 }, (_, c) => c * 3 + r));

function Cell({
  spot,
  stake,
  onBet,
  className,
  winning,
  disabled,
  children,
}: {
  spot: Spot;
  stake: number;
  onBet: (s: Spot) => void;
  className?: string;
  winning?: boolean;
  disabled?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() => onBet(spot)}
      disabled={disabled}
      aria-label={`Bet on ${spot.label}${stake ? `, ${formatCredits(stake)} placed` : ""}. Pays ${ODDS[spot.kind]} to 1`}
      className={cn(
        "relative grid place-items-center border border-gold/30 text-xs font-bold text-ivory transition-colors hover:bg-white/10 disabled:cursor-not-allowed sm:text-sm",
        winning && "z-10 ring-2 ring-gold ring-inset shadow-[0_0_20px_rgb(212_175_98/0.8)]",
        className,
      )}
    >
      {children ?? spot.label}
      {stake > 0 && (
        <motion.span initial={{ scale: 0, y: -10 }} animate={{ scale: 1, y: 0 }} className="absolute -right-1 -top-1 z-10">
          <span className="grid h-6 min-w-6 place-items-center rounded-full border-2 border-dashed border-ink bg-gold px-1 text-[0.55rem] font-extrabold tabular-nums text-ink shadow">
            {stake >= 100 ? (stake >= 100_000 ? `${Math.round(stake / 100_000)}K` : stake / 100) : `.${stake}`}
          </span>
        </motion.span>
      )}
    </button>
  );
}

export function RouletteTable({
  game,
  minBet,
  maxBet,
  initialBalance,
  recent,
}: {
  game: { id: string; name: string };
  minBet: number;
  maxBet: number;
  initialBalance: number;
  recent: number[];
}) {
  const reduce = useReducedMotion();
  const { balance, busy, error, setError, run, refreshShell } = useRound<RouletteView>(null, initialBalance);
  const chips = useMemo(() => CHIP_VALUES.filter((c) => c <= maxBet && c >= Math.max(1, Math.floor(minBet / 10))), [minBet, maxBet]);
  const [chip, setChip] = useState(chips[Math.min(2, chips.length - 1)]);
  const [placed, setPlaced] = useState<Bet[]>([]); // in placement order, for undo
  const [lastBets, setLastBets] = useState<Bet[] | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<RouletteView | null>(null);
  const [history, setHistory] = useState<number[]>(recent);
  const [spinNo, setSpinNo] = useState(0);

  const wheelDeg = useMotionValue(0);
  const ballDeg = useMotionValue(0);
  const ballRadius = useMotionValue(128);

  const stakes = useMemo(() => {
    const m = new Map<string, number>();
    for (const b of placed) m.set(betKey(b), (m.get(betKey(b)) ?? 0) + b.amount);
    return m;
  }, [placed]);
  const total = placed.reduce((a, b) => a + b.amount, 0);
  const locked = busy || spinning;

  function place(spot: Spot) {
    if (locked) return;
    if (result) setResult(null);
    if (total + chip > maxBet) return setError({ code: "limits", message: `Table maximum is ${formatCredits(maxBet)} credits per spin.` });
    setError(null);
    playSound("chip");
    setPlaced((p) => [...p, { kind: spot.kind, value: spot.value, amount: chip }]);
  }

  const stakeOf = (kind: BetKind, value?: number) => stakes.get(betKey({ kind, value })) ?? 0;
  const won = (kind: BetKind, value?: number) => !!result && !spinning && result.bets.some((b) => b.won && b.kind === kind && b.value === value);

  async function spin(bets = placed) {
    if (locked || !bets.length) return;
    const staked = bets.reduce((a, b) => a + b.amount, 0);
    if (staked < minBet) return setError({ code: "limits", message: `Minimum total bet is ${formatCredits(minBet)} credits.` });
    if (staked > balance) return setError({ code: "funds", message: "Not enough credits for these bets." });
    setResult(null);
    const res = await run((requestId) => spinRoulette({ gameId: game.id, bets, requestId }));
    if (!res?.ok) return;

    // The result is already decided on the server; the wheel animates to it.
    const view = res.view;
    const index = WHEEL_ORDER.indexOf(view.number as (typeof WHEEL_ORDER)[number]);
    setSpinning(true);
    const duration = reduce ? 0.01 : 4.2;
    if (!reduce) playSound("wheel");
    const current = wheelDeg.get();
    const target = current - (current % 360) - 360 * 4 - index * POCKET;
    ballRadius.set(128);
    await Promise.all([
      animate(wheelDeg, target, { duration, ease: [0.12, 0.6, 0.18, 1] }),
      animate(ballDeg, [0, 360 * 5], { duration, ease: [0.2, 0.7, 0.3, 1] }),
      animate(ballRadius, [140, 140, 118], { duration, times: [0, 0.7, 1] }),
    ]);
    ballDeg.set(0);
    setSpinning(false);
    setResult(view);
    setSpinNo((n) => n + 1);
    setHistory((h) => [view.number, ...h].slice(0, 14));
    setLastBets(bets);
    setPlaced([]);
    refreshShell();
  }

  const net = result ? result.returned - result.staked : 0;

  return (
    <div className="space-y-4">
      <div className="relative grid items-center gap-5 overflow-hidden rounded-[2rem] border-gold-gradient p-4 shadow-[0_40px_80px_-30px_rgb(0_0_0/0.95)] sm:p-6">
        <div aria-hidden className="absolute inset-[1.5px] rounded-[calc(2rem-1.5px)] bg-[radial-gradient(120%_90%_at_50%_0%,#145238,#0b2a1e_55%,#07140f)]" />
        <div className="relative mx-auto w-full max-w-[19rem] sm:max-w-[21rem]">
          <Wheel wheelDeg={wheelDeg} ballDeg={ballDeg} ballRadius={ballRadius} />
          <ResultBanner
            id={spinNo}
            show={!!result && !spinning}
            title={result ? `${result.number} ${result.color}` : ""}
            amount={result && result.returned > 0 ? `+${formatCredits(result.returned)}` : undefined}
            sub={result ? (net > 0 ? `Net +${formatCredits(net)}` : net === 0 ? "Stake back: break even" : result.returned > 0 ? `Net −${formatCredits(-net)}` : "No winning bets") : undefined}
            tone={result && result.returned > 0 ? "win" : "loss"}
          />
        </div>

        <div className="relative min-w-0">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-[0.6rem] font-bold uppercase tracking-[0.25em] text-gold/80">
              {spinning ? "No more bets" : "Place your bets"}
              <span className="ml-2 font-normal normal-case tracking-normal text-muted sm:hidden">· swipe the board</span>
            </p>
            <div className="scrollbar-none flex gap-1 overflow-x-auto" aria-label="Recent results">
              {history.map((n, i) => (
                <motion.span
                  key={`${n}-${i}-${history.length}`}
                  initial={i === 0 ? { scale: 0 } : false}
                  animate={{ scale: 1 }}
                  className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-full text-[0.65rem] font-bold text-ivory", i === 0 && "ring-2 ring-gold")}
                  style={{ background: FILL[colorOf(n)] }}
                >
                  {n}
                </motion.span>
              ))}
            </div>
          </div>

          {/* Board */}
          <div className="scrollbar-none -mx-1 overflow-x-auto px-1 pb-1">
            <div className="min-w-[600px] select-none">
              <div className="grid grid-cols-[3rem_repeat(12,minmax(0,1fr))_3.5rem]">
                <Cell
                  spot={{ kind: "straight", value: 0, label: "0" }}
                  stake={stakeOf("straight", 0)}
                  onBet={place}
                  winning={won("straight", 0)}
                  disabled={locked}
                  className="row-span-3 rounded-l-xl"
                >
                  <span className="grid h-full w-full place-items-center rounded-l-xl" style={{ background: FILL.green }}>
                    0
                  </span>
                </Cell>
                {ROWS_TOP_DOWN.map((row, r) => (
                  <div key={r} className="col-span-12 col-start-2 grid grid-cols-12" style={{ gridRow: r + 1 }}>
                    {row.map((n) => (
                      <Cell key={n} spot={{ kind: "straight", value: n, label: String(n) }} stake={stakeOf("straight", n)} onBet={place} winning={won("straight", n)} disabled={locked} className="h-12">
                        <span className="grid h-8 w-8 place-items-center rounded-full" style={{ background: FILL[colorOf(n)] }}>
                          {n}
                        </span>
                      </Cell>
                    ))}
                  </div>
                ))}
                {[3, 2, 1].map((c, r) => (
                  <Cell key={c} spot={{ kind: "column", value: c, label: `Column ${c}` }} stake={stakeOf("column", c)} onBet={place} winning={won("column", c)} disabled={locked} className={cn("text-[0.65rem]", r === 0 && "rounded-tr-xl", r === 2 && "rounded-br-xl")}>
                    2 to 1
                  </Cell>
                ))}
              </div>
              <div className="ml-12 mr-14 grid grid-cols-3">
                {[1, 2, 3].map((d) => (
                  <Cell key={d} spot={{ kind: "dozen", value: d, label: `${d === 1 ? "1st" : d === 2 ? "2nd" : "3rd"} 12` }} stake={stakeOf("dozen", d)} onBet={place} winning={won("dozen", d)} disabled={locked} className="h-10" />
                ))}
              </div>
              <div className="ml-12 mr-14 grid grid-cols-6">
                {(
                  [
                    { kind: "low", label: "1 to 18" },
                    { kind: "even", label: "Even" },
                    { kind: "red", label: "Red" },
                    { kind: "black", label: "Black" },
                    { kind: "odd", label: "Odd" },
                    { kind: "high", label: "19 to 36" },
                  ] as Spot[]
                ).map((s, i) => (
                  <Cell key={s.kind} spot={s} stake={stakeOf(s.kind)} onBet={place} winning={won(s.kind)} disabled={locked} className={cn("h-10", i === 0 && "rounded-bl-xl", i === 5 && "rounded-br-xl")}>
                    {s.kind === "red" || s.kind === "black" ? <span className="h-5 w-9 rotate-45 rounded-sm" style={{ background: FILL[s.kind] }} aria-hidden /> : s.label}
                  </Cell>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="rounded-2xl border border-line bg-surface p-4">
        <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Chip value">
          {chips.map((c) => (
            <Chip key={c} value={c} selected={c === chip} onClick={() => setChip(c)} disabled={locked} />
          ))}
          <div className="ml-auto flex gap-2">
            <button type="button" onClick={() => setPlaced((p) => p.slice(0, -1))} disabled={locked || !placed.length} aria-label="Undo last chip" className="grid h-10 w-10 place-items-center rounded-full border border-line text-muted hover:text-ivory disabled:opacity-30">
              <Undo2 className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => setPlaced([])} disabled={locked || !placed.length} aria-label="Clear bets" className="grid h-10 w-10 place-items-center rounded-full border border-line text-muted hover:text-ivory disabled:opacity-30">
              <Eraser className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => total * 2 <= maxBet && setPlaced((p) => [...p, ...p])}
              disabled={locked || !placed.length || total * 2 > maxBet}
              className="h-10 rounded-full border border-line px-3 text-xs font-bold text-muted hover:text-ivory disabled:opacity-30"
            >
              ×2
            </button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="mr-auto">
            <p className="text-[0.6rem] font-bold uppercase tracking-[0.2em] text-subtle">Total bet</p>
            <p className="font-display text-3xl font-bold tabular-nums text-gold-gradient">{formatCredits(total)}</p>
          </div>
          {lastBets && !placed.length && (
            <Button variant="outline" onClick={() => spin(lastBets)} disabled={locked}>
              <RotateCcw className="h-4 w-4" /> Rebet & spin
            </Button>
          )}
          <Button size="lg" onClick={() => spin()} disabled={locked || !placed.length}>
            {spinning ? "Spinning" : "Spin"}
          </Button>
        </div>
      </div>
      <ErrorLine error={error} />
      <Hud balance={balance} label="Last spin" value={result ? `${net >= 0 ? "+" : "−"}${formatCredits(Math.abs(net))}` : "—"} tone={net > 0 ? "win" : net < 0 ? "loss" : "neutral"} />
    </div>
  );
}
