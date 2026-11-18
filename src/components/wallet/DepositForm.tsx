"use client";

import { useActionState, useState } from "react";
import { ArrowDownToLine, Loader2, Lock } from "lucide-react";
import { createDeposit, type DepositState } from "@/lib/actions/wallet";
import { centsToUnits, CURRENCIES, DEPOSIT_CURRENCIES, rateLabel, type DepositCurrency } from "@/lib/wallet/currencies";
import { DEPOSIT_MAX, DEPOSIT_MIN, DEPOSIT_PRESETS } from "@/lib/wallet/limits";
import { newRequestId } from "@/lib/request-id";
import { Button } from "@/components/ui/Button";
import { FormError, FormSuccess } from "@/components/ui/Field";
import { CoinGlyph, DemoBadge } from "./Demo";
import { cn, formatNumber } from "@/lib/utils";

export function DepositForm({ defaultCurrency, remainingToday }: { defaultCurrency: DepositCurrency; remainingToday: number }) {
  const [state, action, pending] = useActionState<DepositState, FormData>(createDeposit, {});
  // Remount after each created deposit: fresh request id, cleared amount.
  return <Fields key={state.reference ?? "new"} state={state} action={action} pending={pending} defaultCurrency={defaultCurrency} remainingToday={remainingToday} />;
}

function Fields({
  state,
  action,
  pending,
  defaultCurrency,
  remainingToday,
}: {
  state: DepositState;
  action: (fd: FormData) => void;
  pending: boolean;
  defaultCurrency: DepositCurrency;
  remainingToday: number;
}) {
  const e = state.errors ?? {};
  const [requestId] = useState(newRequestId);
  const [currency, setCurrency] = useState<DepositCurrency>(
    (DEPOSIT_CURRENCIES as readonly string[]).includes(state.values?.currency ?? "") ? (state.values!.currency as DepositCurrency) : defaultCurrency,
  );
  const [credits, setCredits] = useState(state.values?.credits ?? "1000");

  const n = Number(credits);
  const valid = Number.isInteger(n) && n * 100 >= DEPOSIT_MIN && n * 100 <= DEPOSIT_MAX;
  const max = Math.min(DEPOSIT_MAX, remainingToday) / 100;

  return (
    <form action={action} className="space-y-6" noValidate>
      {/* Duplicate protection: the server applies a given request id at most once. */}
      <input type="hidden" name="requestId" value={requestId} />
      <FormError message={e.form ?? e.requestId} />

      <fieldset className="min-w-0">
        <legend className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-subtle">
          1 · Demo currency
        </legend>
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {DEPOSIT_CURRENCIES.map((code) => {
            const c = CURRENCIES[code];
            const active = currency === code;
            return (
              <label
                key={code}
                className={cn(
                  "relative flex cursor-pointer flex-col items-center gap-2 rounded-2xl border p-3 text-center transition-all sm:p-4",
                  active ? "border-gold bg-gold/10 shadow-[0_0_30px_-12px_rgb(212_175_98/0.8)]" : "border-line bg-ink/40 hover:border-gold/40",
                )}
              >
                <input type="radio" name="currency" value={code} checked={active} onChange={() => setCurrency(code)} className="sr-only" />
                <CoinGlyph code={code} />
                <span className="text-sm font-bold text-ivory">{code}</span>
                <span className="hidden text-[0.65rem] text-muted sm:block">{c.name}</span>
              </label>
            );
          })}
        </div>
        {e.currency && <p className="mt-1.5 text-xs text-[#ff9aa2]">{e.currency}</p>}
      </fieldset>

      <fieldset className="min-w-0">
        <legend className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-subtle">2 · Amount in credits</legend>
        <div className="flex flex-wrap gap-2">
          {DEPOSIT_PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setCredits(String(p))}
              disabled={p * 100 > remainingToday}
              className={cn(
                "h-9 rounded-full border px-4 text-xs font-bold tabular-nums transition-colors disabled:cursor-not-allowed disabled:opacity-35",
                String(p) === credits ? "border-gold bg-gold text-ink" : "border-line text-muted hover:border-gold/50 hover:text-ivory",
              )}
            >
              {formatNumber(p)}
            </button>
          ))}
        </div>
        <div className="mt-3">
          <label htmlFor="credits" className="sr-only">
            Credits to deposit
          </label>
          <div className={cn("flex items-center rounded-xl border bg-ink focus-within:border-gold/60", e.credits ? "border-ruby/60" : "border-line")}>
            <input
              id="credits"
              name="credits"
              inputMode="numeric"
              autoComplete="off"
              value={credits}
              onChange={(ev) => setCredits(ev.target.value.replace(/[^\d]/g, "").slice(0, 7))}
              aria-invalid={Boolean(e.credits)}
              aria-describedby="credits-hint"
              className="h-14 min-w-0 flex-1 bg-transparent px-4 font-display text-2xl font-bold tabular-nums text-ivory focus:outline-none"
            />
            <span className="pr-4 text-xs font-bold uppercase tracking-[0.2em] text-subtle">credits</span>
          </div>
          <p id="credits-hint" className={cn("mt-1.5 text-xs", e.credits ? "text-[#ff9aa2]" : "text-subtle")}>
            {e.credits ??
              `Between ${formatNumber(DEPOSIT_MIN / 100)} and ${formatNumber(DEPOSIT_MAX / 100)} credits. ${formatNumber(Math.max(0, remainingToday) / 100)} left in today's demo limit.`}
          </p>
        </div>
      </fieldset>

      <div className="rounded-2xl border border-line bg-ink/50 p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-subtle">You simulate sending</span>
          <DemoBadge />
        </div>
        <p className="mt-2 break-all text-2xl font-bold tabular-nums" style={{ color: CURRENCIES[currency].accent }}>
          {valid ? centsToUnits(n * 100, currency) : "—"} <span className="text-base">{currency}</span>
        </p>
        <p className="mt-1 text-xs text-muted">
          Fixed demo rate: {rateLabel(currency)}. Not a market price.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button type="submit" size="lg" disabled={pending || max < DEPOSIT_MIN / 100} className="sm:min-w-64">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowDownToLine className="h-4 w-4" />}
          {pending ? "Creating demo deposit" : "Create demo deposit"}
        </Button>
        <p className="flex items-center gap-1.5 text-xs text-subtle">
          <Lock className="h-3.5 w-3.5" /> No real payment is requested or possible.
        </p>
      </div>
      <FormSuccess message={state.message} />
    </form>
  );
}
