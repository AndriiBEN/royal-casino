"use client";

import { useActionState, useState } from "react";
import { Ban, CheckCircle2, Coins, Loader2, LogOut } from "lucide-react";
import { adjustWallet, revokeUserSessions, setUserStatus } from "@/lib/actions/admin";
import type { FormState } from "@/lib/actions/types";
import { newRequestId } from "@/lib/request-id";
import { Button } from "@/components/ui/Button";
import { FormError, FormSuccess } from "@/components/ui/Field";
import { cn, formatCredits } from "@/lib/utils";

const inputCls = "h-10 w-full rounded-xl border border-line bg-ink px-3 text-sm text-ivory placeholder:text-subtle focus:border-gold/60 focus:outline-none";

/** Suspend or reactivate. A reason is required and goes into the audit log. */
export function StatusForm({ userId, status, disabled, disabledReason }: { userId: string; status: string; disabled?: boolean; disabledReason?: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(setUserStatus, {});
  const next = status === "active" ? "suspended" : "active";
  return (
    <form key={state.message ?? "status"} action={action} className="space-y-3">
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="status" value={next} />
      <FormError message={state.errors?.form} />
      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-muted">Reason (recorded in the audit log)</span>
        <input name="reason" required minLength={3} maxLength={200} placeholder={next === "suspended" ? "e.g. Abusive chat reported" : "e.g. Appeal accepted"} className={inputCls} disabled={disabled} />
        {state.errors?.reason && <span className="mt-1 block text-xs text-[#ff9aa2]">{state.errors.reason}</span>}
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" variant={next === "suspended" ? "dark" : "gold"} disabled={pending || disabled} title={disabled ? disabledReason : undefined}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : next === "suspended" ? <Ban className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
          {next === "suspended" ? "Suspend account" : "Reactivate account"}
        </Button>
        {disabled && disabledReason && <span className="text-xs text-subtle">{disabledReason}</span>}
        <FormSuccess message={state.message} />
      </div>
    </form>
  );
}

/**
 * Credit or debit a wallet. Goes through the audited wallet service like every other
 * balance change: ledger row + audit row with the admin, reason and before/after balance.
 */
export function AdjustWalletPanel({ userId, balance }: { userId: string; balance: number }) {
  const [state, action, pending] = useActionState<FormState, FormData>(adjustWallet, {});
  return <AdjustInner key={state.message ?? "adj"} userId={userId} balance={balance} state={state} action={action} pending={pending} />;
}

function AdjustInner({ userId, balance, state, action, pending }: { userId: string; balance: number; state: FormState; action: (fd: FormData) => void; pending: boolean }) {
  const [requestId] = useState(newRequestId); // one id per attempt: a double submit is applied once
  const [credits, setCredits] = useState("");
  const n = Number(credits);
  const preview = Number.isInteger(n) && n !== 0 ? balance + n * 100 : null;
  const e = state.errors ?? {};
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="requestId" value={requestId} />
      <FormError message={e.form} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[10rem_1fr]">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-muted">Credits (+/−)</span>
          <input name="credits" inputMode="numeric" value={credits} onChange={(ev) => setCredits(ev.target.value.replace(/[^\d-]/g, "").slice(0, 9))} placeholder="e.g. 500 or -200" className={cn(inputCls, e.credits && "border-ruby/60")} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-muted">Reason (required, audited)</span>
          <input name="note" required minLength={3} maxLength={120} placeholder="e.g. Compensation for interrupted round" className={cn(inputCls, e.note && "border-ruby/60")} />
        </label>
      </div>
      {(e.credits || e.note) && <p className="text-xs text-[#ff9aa2]">{e.credits ?? e.note}</p>}
      <p className="text-xs text-muted">
        Balance {formatCredits(balance)}
        {preview !== null && (
          <>
            {" "}
            → <b className={preview < 0 ? "text-[#ff9aa2]" : "text-ivory"}>{formatCredits(preview)}</b>
          </>
        )}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" variant="outline" disabled={pending || preview === null}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Coins className="h-4 w-4" />}
          Apply adjustment
        </Button>
        <FormSuccess message={state.message} />
      </div>
    </form>
  );
}

export function RevokeSessionsForm({ userId, sessions, disabled }: { userId: string; sessions: number; disabled?: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(revokeUserSessions, {});
  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="userId" value={userId} />
      <Button type="submit" size="sm" variant="dark" disabled={pending || disabled || sessions === 0}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
        Sign out everywhere ({sessions})
      </Button>
      <FormError message={state.errors?.form} />
      <FormSuccess message={state.message} />
    </form>
  );
}
