"use client";

import { useActionState } from "react";
import { KeyRound, Loader2, MonitorSmartphone } from "lucide-react";
import { changePassword, signOutOtherDevices } from "@/lib/actions/account";
import type { FormState } from "@/lib/actions/types";
import { Button } from "@/components/ui/Button";
import { Field, FormError, FormSuccess } from "@/components/ui/Field";
import { PasswordInput } from "@/components/ui/PasswordInput";

export function PasswordForm({ username }: { username: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(changePassword, {});
  const e = state.errors ?? {};

  return (
    // Remount on success so the fields clear.
    <form key={state.message ?? "pw"} action={action} className="space-y-5" noValidate>
      {/* Lets password managers attach the new password to the right account. Not submitted. */}
      <input type="text" autoComplete="username" value={username} readOnly hidden aria-hidden />
      <FormError message={e.form} />
      <Field label="Current password" name="current" error={e.current}>
        <PasswordInput id="current" name="current" autoComplete="current-password" invalid={Boolean(e.current)} />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="New password" name="password" error={e.password} hint="10+ characters, with a letter and a number">
          <PasswordInput id="password" name="password" autoComplete="new-password" invalid={Boolean(e.password)} meter />
        </Field>
        <Field label="Confirm new password" name="confirm" error={e.confirm}>
          <PasswordInput id="confirm" name="confirm" autoComplete="new-password" invalid={Boolean(e.confirm)} />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
          Change password
        </Button>
        <FormSuccess message={state.message} />
      </div>
    </form>
  );
}

export function SignOutOthersForm({ otherSessions }: { otherSessions: number }) {
  const [state, action, pending] = useActionState<FormState, FormData>(async () => signOutOtherDevices(), {});

  return (
    <form action={action} className="flex flex-wrap items-center gap-4">
      <Button type="submit" variant="dark" size="sm" disabled={pending || otherSessions === 0}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <MonitorSmartphone className="h-4 w-4" />}
        Sign out other devices
      </Button>
      <FormSuccess message={state.message} />
    </form>
  );
}
