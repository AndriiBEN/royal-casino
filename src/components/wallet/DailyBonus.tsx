"use client";

import { useActionState, useEffect, useState } from "react";
import { playSound } from "@/lib/sound";
import { motion } from "framer-motion";
import { Check, Flame, Gift, Loader2 } from "lucide-react";
import { claimDailyBonus } from "@/lib/actions/wallet";
import type { FormState } from "@/lib/actions/types";
import type { DailyBonusInfo } from "@/lib/profile/bonus";
import { bonusFor, STREAK_MAX_DAYS, STREAK_STEP } from "@/lib/vip";
import { Button } from "@/components/ui/Button";
import { cn, formatCredits } from "@/lib/utils";

function remaining(ms: number) {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * Daily demo bonus: base amount set by VIP tier, +10% per consecutive day (up to +50%).
 * The amounts shown are computed on the server; the claim recomputes them there.
 */
export function DailyBonus({ info, compact = false }: { info: DailyBonusInfo; compact?: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(async () => claimDailyBonus(), {});
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (state.message) playSound("bonus");
  }, [state]);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const waitMs = info.availableAt && now ? info.availableAt - now : 0;
  const ready = !info.availableAt || (now !== null && waitMs <= 0);
  // Track shows a 7-day week; the reward stops growing after day 6.
  const week = Array.from({ length: 7 }, (_, i) => i + 1);
  const claimedThrough = ready ? info.nextDay - 1 : info.streak;
  const weekOffset = Math.floor(Math.max(0, claimedThrough - 1) / 7) * 7;

  return (
    <form action={action} className="flex h-full flex-col">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gold-gradient text-ink">
          <Gift className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="font-display text-2xl text-ivory">Daily demo bonus</p>
          <p className="text-xs text-muted">
            {info.tierName} base {formatCredits(info.base)} · +{STREAK_STEP}% per day in a row
          </p>
        </div>
        {info.streak > 1 && (
          <span className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full border border-gold/40 bg-gold/10 px-2.5 py-1 text-xs font-bold text-gold-light">
            <Flame className="h-3.5 w-3.5" /> {info.streak}
          </span>
        )}
      </div>

      {!compact && (
        <ol className="mt-5 grid grid-cols-7 gap-1.5" aria-label="Seven-day streak">
          {week.map((d) => {
            const day = d + weekOffset;
            const done = day <= claimedThrough;
            const isNext = ready && day === info.nextDay;
            return (
              <li key={d} className="text-center">
                <motion.span
                  initial={false}
                  animate={isNext ? { scale: [1, 1.08, 1] } : { scale: 1 }}
                  transition={isNext ? { duration: 1.6, repeat: Infinity } : undefined}
                  className={cn(
                    "mx-auto grid h-9 w-9 place-items-center rounded-full border text-[0.65rem] font-bold tabular-nums",
                    done ? "border-transparent bg-gold-gradient text-ink" : isNext ? "border-gold text-gold-light" : "border-line text-subtle",
                  )}
                  aria-label={`Day ${day}${done ? ", claimed" : isNext ? ", next" : ""}`}
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : day}
                </motion.span>
                <span className="mt-1 block text-[0.55rem] tabular-nums text-subtle">+{STREAK_STEP * Math.min(day - 1, STREAK_MAX_DAYS - 1)}%</span>
              </li>
            );
          })}
        </ol>
      )}

      <div className="mt-auto pt-5">
        {ready ? (
          <Button type="submit" className="w-full" disabled={pending}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Claim {formatCredits(info.amount)} credits
          </Button>
        ) : (
          <div className="rounded-full border border-line bg-ink py-3 text-center text-sm text-muted">
            Next bonus in <span className="font-bold tabular-nums text-gold-light">{now === null ? "--:--:--" : remaining(waitMs)}</span>
            <span className="hidden sm:inline"> · {formatCredits(bonusFor(info.base, info.streak + 1))}</span>
          </div>
        )}
        <p className="mt-2 min-h-5 text-center text-xs" aria-live="polite">
          {state.message && <span className="text-[#8ff0c2]">{state.message}</span>}
          {state.errors?.form && <span className="text-[#ff9aa2]">{state.errors.form}</span>}
          {!state.message && !state.errors?.form && <span className="text-subtle">Virtual credits · no cash value</span>}
        </p>
      </div>
    </form>
  );
}
