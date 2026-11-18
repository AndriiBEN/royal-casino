"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ArrowRight, AtSign, Loader2, Mail, User, UserRound } from "lucide-react";
import { login, register } from "@/lib/actions/auth";
import type { FormState } from "@/lib/actions/types";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Field, FormError } from "@/components/ui/Field";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { cn } from "@/lib/utils";

const inputCls = (error?: string) => cn("rounded-xl", error && "border-ruby/60");

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(login, {});
  const e = state.errors ?? {};

  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="next" value={next} />
      <FormError message={e.form} />
      <Field label="Username or email" name="identifier" error={e.identifier}>
        <Input
          id="identifier"
          name="identifier"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          defaultValue={state.values?.identifier}
          maxLength={254}
          icon={<AtSign className="h-4 w-4" />}
          aria-invalid={Boolean(e.identifier)}
          aria-describedby={e.identifier ? "identifier-error" : undefined}
          className={inputCls(e.identifier)}
          autoFocus
          required
        />
      </Field>
      <Field label="Password" name="password" error={e.password}>
        <PasswordInput id="password" name="password" autoComplete="current-password" invalid={Boolean(e.password)} />
      </Field>
      <Button type="submit" className="w-full" size="lg" disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {pending ? "Signing in" : "Login"}
        {!pending && <ArrowRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-1" />}
      </Button>
      <p className="text-center text-sm text-muted">
        New to Royal Casino?{" "}
        <Link
          href={`/register${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`}
          className="font-semibold text-gold underline-offset-4 hover:underline"
        >
          Create an account
        </Link>
      </p>
    </form>
  );
}

export function RegisterForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(register, {});
  const e = state.errors ?? {};
  const v = state.values ?? {};

  return (
    <form action={action} className="space-y-5" noValidate>
      {next && <input type="hidden" name="next" value={next} />}
      <FormError message={e.form} />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Username" name="username" error={e.username} hint="3–20 letters, numbers or _">
          <Input
            id="username"
            name="username"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            defaultValue={v.username}
            icon={<User className="h-4 w-4" />}
            aria-invalid={Boolean(e.username)}
            className={inputCls(e.username)}
            maxLength={20}
            autoFocus
            required
          />
        </Field>
        <Field label="Display name" name="displayName" error={e.displayName} hint="Shown on the winners board">
          <Input
            id="displayName"
            name="displayName"
            autoComplete="nickname"
            defaultValue={v.displayName}
            icon={<UserRound className="h-4 w-4" />}
            aria-invalid={Boolean(e.displayName)}
            className={inputCls(e.displayName)}
            maxLength={32}
            required
          />
        </Field>
      </div>
      <Field label="Email" name="email" error={e.email}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={v.email}
          icon={<Mail className="h-4 w-4" />}
          aria-invalid={Boolean(e.email)}
          className={inputCls(e.email)}
          maxLength={254}
          required
        />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Password" name="password" error={e.password} hint="10+ characters, with a letter and a number">
          <PasswordInput id="password" name="password" autoComplete="new-password" invalid={Boolean(e.password)} meter />
        </Field>
        <Field label="Confirm password" name="confirm" error={e.confirm}>
          <PasswordInput id="confirm" name="confirm" autoComplete="new-password" invalid={Boolean(e.confirm)} />
        </Field>
      </div>
      <div>
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-ink/40 p-4 text-sm text-muted transition-colors hover:border-gold/30">
          <input
            key={v.adult ?? "init"}
            type="checkbox"
            name="adult"
            defaultChecked={v.adult === "on"}
            className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-[#D4AF62]"
            required
          />
          <span>
            I am 18 or older and understand Royal Casino uses virtual credits with no cash value.{" "}
            <Link href="/responsible-gaming" className="text-gold hover:underline">
              Responsible gaming
            </Link>
          </span>
        </label>
        {e.adult && (
          <p role="alert" className="mt-1.5 text-xs text-[#ff9aa2]">
            {e.adult}
          </p>
        )}
      </div>
      <Button type="submit" className="w-full" size="lg" disabled={pending}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        {pending ? (
          "Creating account"
        ) : (
          <>
            Create account<span className="-ml-1 hidden sm:inline">and claim 10,000 credits</span>
          </>
        )}
      </Button>
      <p className="text-center text-sm text-muted">
        Already a member?{" "}
        <Link href={`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-gold underline-offset-4 hover:underline">
          Login
        </Link>
      </p>
    </form>
  );
}
