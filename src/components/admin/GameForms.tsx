"use client";

import { useActionState, useMemo, useState } from "react";
import { Loader2, Power, Save } from "lucide-react";
import { setGameEnabled, updateGame } from "@/lib/actions/admin";
import type { FormState } from "@/lib/actions/types";
import { publishedRtp } from "@/lib/games/config";
import { PAY_SCALE_MAX, PAY_SCALE_MIN } from "@/lib/games/slots/engine";
import { Button } from "@/components/ui/Button";
import { FormError, FormSuccess } from "@/components/ui/Field";
import { cn } from "@/lib/utils";

export function GameToggle({ gameId, enabled, name }: { gameId: string; enabled: boolean; name: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(setGameEnabled, {});
  return (
    <form action={action} className="inline-flex flex-col items-start gap-1">
      <input type="hidden" name="gameId" value={gameId} />
      <input type="hidden" name="enabled" value={String(!enabled)} />
      <button
        type="submit"
        disabled={pending}
        role="switch"
        aria-checked={enabled}
        aria-label={`${enabled ? "Disable" : "Enable"} ${name}`}
        className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50", enabled ? "bg-gold" : "bg-white/15")}
      >
        <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-ink shadow transition-all", enabled ? "left-[1.375rem]" : "left-0.5")} />
      </button>
      {state.errors?.form && <span className="text-[0.65rem] text-[#ff9aa2]">{state.errors.form}</span>}
    </form>
  );
}

type GameFormProps = {
  game: {
    id: string;
    name: string;
    engine: string;
    category: string;
    enabled: boolean;
    isFeatured: boolean;
    isHot: boolean;
    isNew: boolean;
    minBet: number;
    maxBet: number;
    jackpot: number | null;
    config: { payScale?: number; blackjackPays?: "3:2" | "6:5"; dealerHitsSoft17?: boolean; laPartage?: boolean; opponents?: number };
  };
};

const field = "h-10 w-full rounded-xl border border-line bg-ink px-3 text-sm text-ivory focus:border-gold/60 focus:outline-none";

function Toggle({ name, label, hint, defaultChecked, onChange }: { name: string; label: string; hint?: string; defaultChecked: boolean; onChange?: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-ink/40 p-3">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} onChange={(e) => onChange?.(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#D4AF62]" />
      <span>
        <span className="block text-sm font-semibold text-ivory">{label}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
    </label>
  );
}

/** Edits availability, limits, lobby flags and the engine's payout rules. RTP is shown, not typed. */
export function GameForm({ game }: GameFormProps) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateGame, {});
  const [payScale, setPayScale] = useState(game.config.payScale ?? 100);
  const [bjPays, setBjPays] = useState(game.config.blackjackPays ?? "3:2");
  const [h17, setH17] = useState(game.config.dealerHitsSoft17 ?? false);
  const e = state.errors ?? {};
  const isJackpot = game.category === "jackpots" && game.jackpot !== null;

  const rtp = useMemo(() => {
    const cfg = game.engine === "slots" ? { payScale } : game.engine === "blackjack" ? { blackjackPays: bjPays, dealerHitsSoft17: h17 } : game.config;
    return publishedRtp(game.engine, JSON.stringify(cfg), isJackpot);
  }, [game.engine, game.config, payScale, bjPays, h17, isJackpot]);

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="gameId" value={game.id} />
      <FormError message={e.form} />

      <fieldset className="space-y-3">
        <legend className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-subtle">Availability</legend>
        <Toggle name="enabled" label="Enabled" hint="Disabled games disappear from the lobby and cannot start new rounds. Rounds in progress can still finish." defaultChecked={game.enabled} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Toggle name="isFeatured" label="Featured" defaultChecked={game.isFeatured} />
          <Toggle name="isHot" label="Hot" defaultChecked={game.isHot} />
          <Toggle name="isNew" label="New" defaultChecked={game.isNew} />
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-subtle">{game.engine === "holdem" ? "Stakes (big blind = min bet)" : "Bet limits (credits)"}</legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted">{game.engine === "holdem" ? "Big blind" : game.engine === "slots" ? "Minimum total bet" : "Minimum bet"}</span>
            <input name="minBet" type="number" step="0.01" min="0.01" defaultValue={(game.minBet / 100).toFixed(2)} className={cn(field, e.minBet && "border-ruby/60")} />
            {e.minBet && <span className="mt-1 block text-xs text-[#ff9aa2]">{e.minBet}</span>}
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted">{game.engine === "slots" ? "Maximum total bet" : "Maximum bet"}</span>
            <input name="maxBet" type="number" step="0.01" min="0.01" defaultValue={(game.maxBet / 100).toFixed(2)} className={cn(field, e.maxBet && "border-ruby/60")} />
            {e.maxBet && <span className="mt-1 block text-xs text-[#ff9aa2]">{e.maxBet}</span>}
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-subtle">Demo payout configuration</legend>
        {game.engine === "slots" && (
          <label className="block rounded-xl border border-line bg-ink/40 p-4">
            <span className="flex items-baseline justify-between text-sm font-semibold text-ivory">
              Pay scale <span className="tabular-nums text-gold-light">{payScale}%</span>
            </span>
            <input name="payScale" type="range" min={PAY_SCALE_MIN} max={PAY_SCALE_MAX} step={1} value={payScale} onChange={(ev) => setPayScale(Number(ev.target.value))} className="mt-3 w-full accent-[#D4AF62]" />
            <span className="mt-1 flex justify-between text-[0.65rem] text-subtle">
              <span>{PAY_SCALE_MIN}%</span>
              <span>standard 100%</span>
              <span>{PAY_SCALE_MAX}%</span>
            </span>
            <span className="mt-2 block text-xs text-muted">Scales every line and scatter pay. Free spins keep the scale of the spin that triggered them.</span>
          </label>
        )}
        {game.engine === "blackjack" && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block rounded-xl border border-line bg-ink/40 p-3">
              <span className="mb-1 block text-sm font-semibold text-ivory">Blackjack pays</span>
              <select name="blackjackPays" value={bjPays} onChange={(ev) => setBjPays(ev.target.value as "3:2" | "6:5")} className={field}>
                <option value="3:2">3 to 2 (standard)</option>
                <option value="6:5">6 to 5</option>
              </select>
            </label>
            <Toggle name="dealerHitsSoft17" label="Dealer hits soft 17" hint="Off = dealer stands on all 17s" defaultChecked={h17} onChange={setH17} />
          </div>
        )}
        {game.engine === "roulette" && (
          <Toggle name="laPartage" label="La Partage" hint="When zero hits, even-money bets return half their stake (98.65% on those bets)." defaultChecked={game.config.laPartage ?? false} />
        )}
        {game.engine === "holdem" && (
          <label className="block rounded-xl border border-line bg-ink/40 p-3">
            <span className="mb-1 block text-sm font-semibold text-ivory">AI opponents</span>
            <select name="opponents" defaultValue={String(game.config.opponents ?? 3)} className={field}>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n} {n === 1 ? "(heads-up)" : ""}
                </option>
              ))}
            </select>
          </label>
        )}
        <p className="mt-3 rounded-xl border border-gold/30 bg-gold/[0.06] px-4 py-3 text-sm text-muted">
          Published RTP: <b className="tabular-nums text-gold-light">{rtp ? `${rtp.toFixed(1)}%` : "no house edge (no rake)"}</b>
          {isJackpot && " (includes the 1% progressive pool)"}. Derived from simulation of these exact rules; it cannot be typed in.
        </p>
      </fieldset>

      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-muted">Note for the audit log (optional)</span>
        <input name="note" maxLength={200} placeholder="Why this change?" className={field} />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save changes
        </Button>
        <FormSuccess message={state.message} />
        <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-subtle">
          <Power className="h-3.5 w-3.5" /> Changes apply to new rounds immediately
        </span>
      </div>
    </form>
  );
}
