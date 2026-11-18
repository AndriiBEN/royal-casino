"use client";

import { useActionState, useOptimistic, startTransition } from "react";
import { Loader2 } from "lucide-react";
import { setDisplayCurrency } from "@/lib/actions/wallet";
import type { FormState } from "@/lib/actions/types";
import { CURRENCY_CODES, type CurrencyCode } from "@/lib/wallet/currencies";
import { cn } from "@/lib/utils";

/** Chooses which unit the wallet displays. The balance itself is always held in credits. */
export function CurrencySelector({ current }: { current: CurrencyCode }) {
  const [state, action, pending] = useActionState<FormState, FormData>(setDisplayCurrency, {});
  const [shown, setShown] = useOptimistic(current);

  return (
    <form action={action} className="flex flex-col gap-1.5">
      <fieldset className="flex flex-wrap items-center gap-1 rounded-full border border-line bg-ink/70 p-1 backdrop-blur">
        <legend className="sr-only">Display currency</legend>
        {CURRENCY_CODES.map((code) => (
          <label
            key={code}
            className={cn(
              "flex h-8 cursor-pointer items-center rounded-full px-3 text-[0.7rem] font-bold uppercase tracking-[0.14em] transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-gold",
              shown === code ? "bg-gold-gradient text-ink" : "text-muted hover:text-ivory",
            )}
          >
            <input
              type="radio"
              name="currency"
              value={code}
              checked={shown === code}
              onChange={() => {
                const fd = new FormData();
                fd.set("currency", code);
                startTransition(() => {
                  setShown(code);
                  action(fd);
                });
              }}
              className="sr-only"
            />
            {code === "CREDITS" ? "Credits" : code}
          </label>
        ))}
        {pending && <Loader2 aria-label="Saving" className="mx-1 h-3.5 w-3.5 animate-spin text-gold" />}
      </fieldset>
      {state.errors?.form && <span className="text-[0.7rem] text-[#ff9aa2]">{state.errors.form}</span>}
    </form>
  );
}
