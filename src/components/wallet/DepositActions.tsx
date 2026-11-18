"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Check, Copy, Loader2, ShieldCheck, X } from "lucide-react";
import { cancelDeposit, confirmDeposit } from "@/lib/actions/wallet";
import type { FormState } from "@/lib/actions/types";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

const CONFIRMATIONS = 3;

export function CopyAddress({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* clipboard unavailable on plain HTTP; the address is selectable */
        }
      }}
      className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-line px-2.5 text-xs font-semibold text-muted transition-colors hover:border-gold/50 hover:text-ivory"
      aria-label="Copy demo address"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-[#8ff0c2]" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

/** Expiry countdown, rendered client-side only to avoid hydration drift. */
export function ExpiresIn({ at }: { at: number }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (now === null) return <span className="tabular-nums">--:--</span>;
  const ms = Math.max(0, at - now);
  const m = Math.floor(ms / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return <span className="tabular-nums">{ms ? `${m}:${String(s).padStart(2, "0")}` : "expired"}</span>;
}

export function DepositActions({ transactionId }: { transactionId: string }) {
  const [confirmState, confirmAction, confirming] = useActionState<FormState, FormData>(confirmDeposit, {});
  const [cancelState, cancelAction, cancelling] = useActionState<FormState, FormData>(cancelDeposit, {});
  const [step, setStep] = useState(0);
  const [simulating, startSimulating] = useTransition();
  const busy = confirming || cancelling || simulating;

  /** Cosmetic: tick through simulated network confirmations, then ask the server to confirm. */
  function simulate() {
    startSimulating(async () => {
      for (let i = 1; i <= CONFIRMATIONS; i++) {
        await new Promise((r) => setTimeout(r, 550));
        setStep(i);
      }
      const fd = new FormData();
      fd.set("transactionId", transactionId);
      // Code after an await leaves the outer transition, so dispatch in a fresh one.
      startSimulating(() => confirmAction(fd));
    });
  }

  const error = confirmState.errors?.form ?? cancelState.errors?.form;

  return (
    <div className="space-y-3">
      <div aria-live="polite" className="flex items-center gap-2" role="status">
        {Array.from({ length: CONFIRMATIONS }, (_, i) => (
          <span
            key={i}
            className={cn("h-1.5 flex-1 rounded-full transition-colors duration-300", i < step ? "bg-gold-gradient" : "bg-white/10")}
          />
        ))}
        <span className="w-28 text-right text-[0.65rem] font-bold uppercase tracking-[0.16em] text-subtle">
          {step ? `${step}/${CONFIRMATIONS} demo conf.` : "Awaiting demo"}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={simulate} disabled={busy} className="flex-1 sm:flex-none">
          {busy && !cancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
          {busy && !cancelling ? "Confirming" : "Simulate confirmation"}
        </Button>
        <form action={cancelAction}>
          <input type="hidden" name="transactionId" value={transactionId} />
          <Button type="submit" variant="outline" disabled={busy}>
            {cancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
            Cancel
          </Button>
        </form>
      </div>
      {error && (
        <p role="alert" className="text-xs text-[#ff9aa2]">
          {error}
        </p>
      )}
    </div>
  );
}
