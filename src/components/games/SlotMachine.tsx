"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Club, Crown, Diamond, Gem, Heart, Minus, Plus, RotateCw, Spade, Sparkles, Star, Zap, type LucideIcon } from "lucide-react";
import { playFreeSpin, spinSlots } from "@/lib/actions/games";
import type { SlotsView } from "@/lib/games/server/slots";
import { LINE_OPTIONS, lineBetsFor, PAYLINES, REELS, type Grid, type SymbolId } from "@/lib/games/slots/engine";
import { GAME_ICONS, PALETTES } from "@/lib/constants";
import { cn, formatCredits } from "@/lib/utils";
import { useRound, type RoundState } from "./play/useRound";
import { ErrorLine, Hud, ResultBanner } from "./play/Hud";
import { playSound } from "@/lib/sound";

type MachineGame = { id: string; name: string; icon: string; palette: string };

const SYMBOL_ICONS: Record<Exclude<SymbolId, "W" | "S">, LucideIcon> = {
  crown: Crown,
  gem: Gem,
  star: Star,
  spade: Spade,
  heart: Heart,
  club: Club,
  diamond: Diamond,
};

const SYMBOL_TONE: Record<Exclude<SymbolId, "W" | "S">, string> = {
  crown: "text-gold-light",
  gem: "text-[#9fd8ff]",
  star: "text-gold",
  spade: "text-ivory",
  heart: "text-[#ff8a95]",
  club: "text-ivory/85",
  diamond: "text-[#ff8a95]/85",
};

/** Cosmetic only: what blurs past while the server is drawing the real result. */
const BLUR: SymbolId[] = ["crown", "gem", "S", "star", "spade", "W", "heart", "club", "diamond"];

/** Deterministic opening grid so server and client render the same markup. */
const OPENING: Grid = [
  ["crown", "gem", "star"],
  ["spade", "W", "heart"],
  ["gem", "S", "club"],
  ["heart", "W", "diamond"],
  ["star", "club", "crown"],
];

export function SymbolIcon({ symbol, game, className, compact = false }: { symbol: SymbolId; game: MachineGame; className?: string; compact?: boolean }) {
  if (symbol === "W") {
    const Emblem = GAME_ICONS[game.icon] ?? Sparkles;
    return (
      <span className={cn("relative grid place-items-center rounded-xl bg-gold-gradient shadow-[0_0_20px_rgb(212_175_98/0.6)]", className)}>
        <Emblem className="h-[45%] w-[45%] text-ink" strokeWidth={2} />
        {!compact && <span className="absolute bottom-[8%] text-[0.5rem] font-extrabold tracking-[0.2em] text-ink sm:text-[0.6rem]">WILD</span>}
      </span>
    );
  }
  if (symbol === "S") {
    return (
      <span className={cn("relative grid place-items-center rounded-xl bg-[radial-gradient(circle,#7a1fa2,#2b0a3d)] shadow-[0_0_20px_rgb(186_104_255/0.55)]", className)}>
        <Zap className="h-[45%] w-[45%] text-[#f3d9ff]" strokeWidth={2} />
        {!compact && <span className="absolute bottom-[8%] text-[0.45rem] font-extrabold tracking-[0.16em] text-[#f3d9ff] sm:text-[0.55rem]">SCATTER</span>}
      </span>
    );
  }
  const Icon = SYMBOL_ICONS[symbol];
  return (
    <span className={cn("grid place-items-center", className)}>
      <Icon className={cn("h-1/2 w-1/2 drop-shadow-[0_2px_8px_rgb(0_0_0/0.6)]", SYMBOL_TONE[symbol])} strokeWidth={1.6} />
    </span>
  );
}

export function SlotMachine({
  game,
  minBet,
  maxBet,
  initialBalance,
  active,
  initialJackpot,
}: {
  game: MachineGame;
  minBet: number;
  maxBet: number;
  initialBalance: number;
  /** an unfinished free-spins round to resume */
  active: RoundState<SlotsView> | null;
  initialJackpot: number | null;
}) {
  const reduce = useReducedMotion();
  const palette = PALETTES[game.palette] ?? PALETTES.obsidian;
  const { round, balance, busy, error, run, refreshShell } = useRound<SlotsView>(active, initialBalance);

  const [lines, setLines] = useState<number>(active?.view.lines ?? 20);
  const betOptions = useMemo(() => lineBetsFor(minBet, maxBet, lines), [minBet, maxBet, lines]);
  const [lineBet, setLineBet] = useState<number>(active?.view.lineBet ?? betOptions[Math.min(2, betOptions.length - 1)] ?? 1);
  const [grid, setGrid] = useState<Grid>(active?.view.spin.grid ?? OPENING);
  const [spinning, setSpinning] = useState<boolean[]>(Array(REELS).fill(false));
  const [revealed, setRevealed] = useState<SlotsView | null>(active?.view ?? null);
  const [spinCount, setSpinCount] = useState(0);
  const [autoFree, setAutoFree] = useState(false);
  const [session, setSession] = useState({ spins: 0, wagered: 0, won: 0 });
  const [jackpot, setJackpot] = useState(initialJackpot);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Keep the line bet valid when the number of lines changes.
  useEffect(() => {
    if (!betOptions.includes(lineBet)) setLineBet(betOptions.reduce((best, b) => (Math.abs(b * lines - lineBet * lines) < Math.abs(best * lines - lineBet * lines) ? b : best), betOptions[0] ?? 1));
  }, [betOptions, lineBet, lines]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const inBonus = round?.view.inBonus ?? false;
  const totalBet = lineBet * lines;
  const animating = spinning.some(Boolean);
  const locked = busy || animating;

  const show = revealed && !animating ? revealed : null;
  const winCells = useMemo(() => {
    const set = new Set<string>();
    if (!show) return set;
    for (const w of show.spin.lineWins) PAYLINES[w.line].slice(0, w.count).forEach((row, reel) => set.add(`${reel}-${row}`));
    return set;
  }, [show]);
  const scatterCells = useMemo(() => {
    const set = new Set<string>();
    if (show && show.spin.scatter.count >= 3) for (const [r, row] of show.spin.scatter.positions) set.add(`${r}-${row}`);
    return set;
  }, [show]);

  const animateTo = useCallback(
    (view: SlotsView, started: number) => {
      const minSpin = reduce ? 0 : 700;
      const wait = Math.max(0, minSpin - (Date.now() - started));
      const stagger = reduce ? 0 : 220;
      // Reels stay blurred until the server result is known; then they stop one by one onto it.
      timers.current.forEach(clearTimeout);
      timers.current = [];
      for (let r = 0; r < REELS; r++) {
        timers.current.push(
          setTimeout(() => {
            playSound("reel");
            setGrid((g) => g.map((col, i) => (i === r ? view.spin.grid[r] : col)));
            setSpinning((s) => s.map((v, i) => (i === r ? false : v)));
          }, wait + r * stagger),
        );
      }
      timers.current.push(
        setTimeout(() => {
          setRevealed(view);
          setSpinCount((c) => c + 1);
          setSession((s) => ({ spins: s.spins + 1, wagered: s.wagered + (view.wasFreeSpin ? 0 : view.totalBet), won: s.won + view.spin.payout + (view.jackpotWon ?? 0) }));
          if (view.jackpot !== null) setJackpot(view.jackpot);
          if (!view.inBonus) refreshShell();
        }, wait + (REELS - 1) * stagger + 200),
      );
    },
    [reduce, refreshShell],
  );

  const spin = useCallback(async () => {
    if (locked) return;
    setRevealed(null);
    setSpinning(Array(REELS).fill(true));
    playSound("spin");
    const started = Date.now();
    const res = inBonus && round
      ? await run((requestId) => playFreeSpin({ roundId: round.roundId, version: round.version, requestId }))
      : await run((requestId) => spinSlots({ gameId: game.id, lineBet, lines, requestId }));
    if (res?.ok) animateTo(res.view, started);
    else {
      setSpinning(Array(REELS).fill(false));
      if (res && !res.ok && res.view) {
        // e.g. a bonus round already in progress: show it so the player can continue.
        setGrid(res.view.spin.grid);
        setRevealed(res.view);
      }
    }
  }, [locked, inBonus, round, run, game.id, lineBet, lines, animateTo]);

  // Auto-play the remaining free spins when switched on.
  useEffect(() => {
    if (!autoFree || !inBonus || locked) return;
    const t = setTimeout(spin, reduce ? 150 : 900);
    return () => clearTimeout(t);
  }, [autoFree, inBonus, locked, spin, reduce]);
  useEffect(() => {
    if (!inBonus) setAutoFree(false);
  }, [inBonus]);

  // Space bar spins (when not typing in a field)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (e.code === "Space" && tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "BUTTON" && tag !== "A" && tag !== "SELECT") {
        e.preventDefault();
        spin();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [spin]);

  const lastWin = show ? show.spin.payout : 0;
  const multiple = show && show.totalBet ? lastWin / show.totalBet : 0;
  const betIndex = betOptions.indexOf(lineBet);
  const bonusJustEnded = show && show.wasFreeSpin && !show.inBonus;
  const bonusJustStarted = show && !show.wasFreeSpin && show.inBonus;

  return (
    <div className="relative">
      <div
        className={cn(
          "relative overflow-hidden rounded-[2rem] border-gold-gradient p-3 shadow-[0_40px_80px_-30px_rgb(0_0_0/0.95)] transition-shadow sm:p-5",
          inBonus && "shadow-[0_0_60px_-10px_rgb(186_104_255/0.55)]",
        )}
        style={{ backgroundImage: `radial-gradient(120% 80% at 50% 0%, ${inBonus ? "#5b1d7a" : palette.via}66, transparent 60%)` }}
      >
        {/* Marquee: jackpot pool or free-spins counter */}
        <div className="mb-3 flex min-h-10 flex-wrap items-center justify-center gap-x-6 gap-y-1 sm:mb-4">
          {inBonus && round ? (
            <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex items-center gap-3 rounded-full border border-[#c58bff]/60 bg-[#2b0a3d]/80 px-4 py-1.5 text-sm">
              <Zap className="h-4 w-4 text-[#f3d9ff]" />
              <span className="font-extrabold uppercase tracking-[0.2em] text-[#f3d9ff]">Free spins ×3</span>
              <span className="tabular-nums text-ivory">
                {round.view.freeSpinsLeft} left · won {formatCredits(round.view.bonusWin)}
              </span>
            </motion.div>
          ) : jackpot !== null ? (
            <div className="text-center">
              <p className="text-[0.6rem] font-bold uppercase tracking-[0.3em] text-gold">Progressive jackpot</p>
              <p className="font-display text-2xl font-bold tabular-nums text-gold-gradient sm:text-3xl">{formatCredits(jackpot)}</p>
            </div>
          ) : (
            <div aria-hidden className="flex justify-center gap-2">
              {Array.from({ length: 15 }).map((_, i) => (
                <span key={i} className={cn("h-1.5 w-1.5 rounded-full bg-gold/30", locked && "animate-pulse bg-gold-light")} style={{ animationDelay: `${(i % 5) * 120}ms` }} />
              ))}
            </div>
          )}
        </div>

        {/* Reels */}
        <div
          className="relative grid grid-cols-5 gap-1.5 rounded-2xl border border-gold/30 bg-ink/90 p-1.5 shadow-[inset_0_0_40px_rgb(0_0_0/0.9)] sm:gap-2.5 sm:p-2.5"
          role="img"
          aria-label={`Reels: ${grid.map((col) => col.join(" ")).join(", ")}`}
        >
          {grid.map((col, reel) => (
            <div key={reel} className="relative overflow-hidden rounded-xl bg-gradient-to-b from-surface-2 via-surface to-surface-2">
              {spinning[reel] ? (
                <div className="flex flex-col" style={{ animation: "reel-blur 0.28s linear infinite" }}>
                  {[...BLUR, ...BLUR].slice(reel, reel + 8).map((s, i) => (
                    <SymbolIcon key={i} symbol={s} game={game} className="aspect-square w-full opacity-60 blur-[1.5px]" />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col">
                  {col.map((s, row) => {
                    const key = `${reel}-${row}`;
                    const hit = winCells.has(key);
                    const scatter = scatterCells.has(key);
                    const anyWin = winCells.size > 0 || scatterCells.size > 0;
                    return (
                      <motion.div
                        key={`${row}-${s}-${spinCount}`}
                        initial={reduce ? false : { y: -24, opacity: 0.4 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ type: "spring", stiffness: 500, damping: 22, delay: row * 0.03 }}
                        className={cn("relative aspect-square w-full p-1.5 transition-opacity duration-300", anyWin && !hit && !scatter && "opacity-30")}
                      >
                        {(hit || scatter) && (
                          <motion.span
                            className={cn("absolute inset-1 rounded-xl border-2", scatter ? "border-[#c58bff] shadow-[0_0_24px_rgb(186_104_255/0.7)]" : "border-gold shadow-[0_0_24px_rgb(212_175_98/0.7)]")}
                            animate={reduce ? undefined : { opacity: [1, 0.45, 1] }}
                            transition={{ duration: 1.2, repeat: Infinity }}
                          />
                        )}
                        <SymbolIcon symbol={s} game={game} className="h-full w-full" />
                      </motion.div>
                    );
                  })}
                </div>
              )}
              <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgb(0_0_0/0.55),transparent_22%,transparent_78%,rgb(0_0_0/0.55))]" />
            </div>
          ))}

          <ResultBanner
            id={`j${spinCount}`}
            show={!!show?.jackpotWon}
            title="Progressive jackpot"
            amount={show?.jackpotWon ? `+${formatCredits(show.jackpotWon)}` : undefined}
            sub="The pool is yours"
            sound="bigWin"
          />
          <ResultBanner
            id={`b${spinCount}`}
            show={!!bonusJustStarted && !show?.jackpotWon}
            title={`${show?.spin.scatter.count ?? 0} scatters`}
            amount={`${show?.freeSpinsLeft ?? 0} free spins`}
            sub="Every win pays ×3"
            sound="bonus"
          />
          <ResultBanner
            id={`e${spinCount}`}
            show={!!bonusJustEnded}
            title="Free spins complete"
            amount={`+${formatCredits(show?.bonusWin ?? 0)}`}
            sub={`${show?.freeSpinsPlayed ?? 0} free spins played`}
          />
          <ResultBanner
            id={`w${spinCount}`}
            show={lastWin > 0 && !bonusJustStarted && !bonusJustEnded && !show?.jackpotWon}
            title={multiple >= 10 ? "Royal win" : "Win"}
            amount={`+${formatCredits(lastWin)}`}
            sub={show?.wasFreeSpin ? "Free spin ×3" : `${multiple.toFixed(1)}× your bet`}
            sound={multiple >= 10 ? "bigWin" : "win"}
          />
        </div>

        {/* Controls */}
        <div className="mt-4 grid items-center gap-3 sm:mt-5 sm:grid-cols-[1fr_auto_1fr]">
          <div className="rounded-2xl border border-line bg-ink/70 px-3 py-2">
            <p className="mb-1.5 text-center text-[0.6rem] font-bold uppercase tracking-[0.2em] text-subtle sm:text-left">Paylines</p>
            <div className="flex justify-center gap-1 sm:justify-start" role="radiogroup" aria-label="Number of paylines">
              {LINE_OPTIONS.map((n) => {
                const possible = lineBetsFor(minBet, maxBet, n).length > 0;
                return (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={lines === n}
                    onClick={() => setLines(n)}
                    disabled={locked || inBonus || !possible}
                    className={cn(
                      "h-9 min-w-9 rounded-lg border px-2 text-xs font-bold tabular-nums transition-colors disabled:opacity-30",
                      lines === n ? "border-gold bg-gold text-ink" : "border-line text-muted hover:border-gold/50 hover:text-ivory",
                    )}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={spin}
            disabled={locked || (!inBonus && totalBet > balance)}
            aria-label={inBonus ? `Free spin, ${round?.view.freeSpinsLeft} left` : locked ? "Spinning" : `Spin for ${formatCredits(totalBet)} credits`}
            className={cn(
              "group relative mx-auto grid h-24 w-24 place-items-center rounded-full text-ink shadow-[0_12px_40px_-8px_rgb(212_175_98/0.8),inset_0_-4px_0_rgb(0_0_0/0.25)] transition-all hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60",
              inBonus ? "bg-[radial-gradient(circle,#e3b8ff,#8e3bc4)] shadow-[0_12px_40px_-8px_rgb(186_104_255/0.9)]" : "bg-gold-gradient",
            )}
          >
            <span aria-hidden className="absolute inset-1.5 rounded-full border border-ink/20" />
            {inBonus && !locked ? (
              <span className="text-center text-[0.65rem] font-extrabold uppercase leading-tight tracking-[0.12em]">
                Free
                <br />
                spin
              </span>
            ) : (
              <RotateCw className={cn("h-9 w-9 transition-transform duration-500", locked ? "animate-spin" : "group-hover:rotate-90")} strokeWidth={2.2} />
            )}
          </button>

          <div className="flex items-center justify-between gap-2 rounded-2xl border border-line bg-ink/70 px-2 py-2">
            <button
              type="button"
              onClick={() => setLineBet(betOptions[Math.max(0, betIndex - 1)])}
              disabled={locked || inBonus || betIndex <= 0}
              aria-label="Decrease line bet"
              className="grid h-10 w-10 place-items-center rounded-xl border border-line text-gold transition-colors hover:border-gold/50 disabled:opacity-30"
            >
              <Minus className="h-4 w-4" />
            </button>
            <div className="text-center">
              <p className="text-[0.6rem] font-bold uppercase tracking-[0.2em] text-subtle">
                {formatCredits(lineBet)} × {lines}
              </p>
              <p className="font-bold tabular-nums text-ivory" aria-live="polite">
                {formatCredits(inBonus && round ? round.view.totalBet : totalBet)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setLineBet(betOptions[Math.min(betOptions.length - 1, betIndex + 1)])}
              disabled={locked || inBonus || betIndex >= betOptions.length - 1}
              aria-label="Increase line bet"
              className="grid h-10 w-10 place-items-center rounded-xl border border-line text-gold transition-colors hover:border-gold/50 disabled:opacity-30"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>

        <AnimatePresence>
          {inBonus && (
            <motion.label
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3 flex cursor-pointer items-center justify-center gap-2 text-sm text-[#f3d9ff]"
            >
              <input type="checkbox" checked={autoFree} onChange={(e) => setAutoFree(e.target.checked)} className="h-4 w-4 accent-[#c58bff]" />
              Auto-play the remaining free spins
            </motion.label>
          )}
        </AnimatePresence>

        <div className="mt-3">
          {error ? (
            <ErrorLine error={error} />
          ) : (
            <p className="min-h-6 text-center text-sm text-muted" aria-live="polite">
              {show && show.spin.lineWins.length > 0
                ? `${show.spin.lineWins.length} winning ${show.spin.lineWins.length === 1 ? "line" : "lines"}${show.spin.lineWins.some((w) => w.wild) ? " · wild ×2" : ""}${show.spin.scatter.payout ? ` · scatters pay ${formatCredits(show.spin.scatter.payout)}` : ""}`
                : show && show.spin.scatter.payout
                  ? `Scatters pay ${formatCredits(show.spin.scatter.payout)}`
                  : <span className="hidden text-xs text-subtle sm:inline">Press space to spin</span>}
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-[1.2fr_1fr_1fr_1fr]">
        <Hud balance={balance} />
        {[
          ["Spins", String(session.spins)],
          ["Wagered", formatCredits(session.wagered)],
          ["Won", formatCredits(session.won)],
        ].map(([k, v]) => (
          <div key={k} className="rounded-xl border border-line bg-surface px-3 py-2.5 text-center">
            <p className="text-[0.6rem] font-bold uppercase tracking-[0.2em] text-subtle">{k}</p>
            <p className="mt-0.5 text-sm font-semibold tabular-nums text-ivory">{v}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

