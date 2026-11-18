"use client";

import { useActionState } from "react";
import { Check, Loader2, Mail, UserRound } from "lucide-react";
import { updateProfile } from "@/lib/actions/account";
import type { FormState } from "@/lib/actions/types";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Field, FormError, FormSuccess } from "@/components/ui/Field";

export function ProfileForm({ displayName, email }: { displayName: string; email: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateProfile, {});
  const e = state.errors ?? {};

  return (
    <form action={action} className="space-y-5" noValidate>
      <FormError message={e.form} />
      <Field label="Display name" name="displayName" error={e.displayName} hint="Shown in the header and on the winners board">
        <Input
          id="displayName"
          name="displayName"
          defaultValue={displayName}
          maxLength={32}
          autoComplete="nickname"
          icon={<UserRound className="h-4 w-4" />}
          aria-invalid={Boolean(e.displayName)}
          className="rounded-xl"
        />
      </Field>
      <Field label="Email" name="email" error={e.email}>
        <Input
          id="email"
          name="email"
          type="email"
          defaultValue={email}
          maxLength={254}
          autoComplete="email"
          icon={<Mail className="h-4 w-4" />}
          aria-invalid={Boolean(e.email)}
          className="rounded-xl"
        />
      </Field>
      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Save profile
        </Button>
        <FormSuccess message={state.message} />
      </div>
    </form>
  );
}
