"use client";

import { useEffect } from "react";
import { RotateCcw, ShieldAlert } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/Button";

/**
 * Shown when a page fails to render. Balances are only ever changed inside database
 * transactions, so a failed page never leaves a half-applied bet or deposit behind.
 */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  // Prisma's "can't reach / no such table" errors mean the local database isn't set up yet.
  const dbMissing = /no such table|does not exist|Can't reach database|P1001|P2021/i.test(error.message ?? "");

  return (
    <div className="shell-container flex min-h-[70dvh] items-center justify-center py-16">
      <div className="w-full max-w-lg rounded-3xl border border-line bg-surface p-8 text-center shadow-card sm:p-10">
        <span className="mx-auto mb-6 grid h-16 w-16 place-items-center rounded-2xl border border-ruby/40 bg-ruby/10 text-[#ff9aa2]">
          <ShieldAlert className="h-7 w-7" />
        </span>
        <h1 className="text-4xl text-ivory">This page didn&apos;t load</h1>
        {dbMissing ? (
          <>
            <p className="mt-3 text-sm leading-relaxed text-muted">The local database isn&apos;t set up yet. Run this once in the project folder, then try again:</p>
            <pre className="mt-5 rounded-xl border border-line bg-ink px-4 py-3 text-left text-sm text-gold-light">npm run setup</pre>
          </>
        ) : (
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Your balance is safe: credits only move when a bet or deposit completes in full. Try again, or go back to the lobby.
          </p>
        )}
        {error.digest && <p className="mt-4 text-xs text-subtle">Reference {error.digest}</p>}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button onClick={reset}>
            <RotateCcw className="h-4 w-4" />
            Try again
          </Button>
          <ButtonLink href="/" variant="outline">
            Back to lobby
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
