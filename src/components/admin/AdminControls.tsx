"use client";

import { useActionState } from "react";
import { Loader2, ShieldHalf, ShieldOff } from "lucide-react";
import { setUserRole } from "@/lib/actions/admin";
import type { FormState } from "@/lib/actions/types";
import { cn } from "@/lib/utils";

export function RoleToggle({ userId, role, isSelf }: { userId: string; role: "USER" | "ADMIN"; isSelf: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(setUserRole, {});
  const next = role === "ADMIN" ? "USER" : "ADMIN";

  return (
    <form action={action} className="flex flex-col items-start gap-1">
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="role" value={next} />
      <button
        type="submit"
        disabled={pending || isSelf}
        title={isSelf ? "You cannot change your own role" : undefined}
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40",
          role === "ADMIN"
            ? "border-ruby/40 text-[#ff9aa2] hover:bg-ruby/10"
            : "border-gold/40 text-gold-light hover:bg-gold/10",
        )}
      >
        {pending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : role === "ADMIN" ? (
          <ShieldOff className="h-3.5 w-3.5" />
        ) : (
          <ShieldHalf className="h-3.5 w-3.5" />
        )}
        {role === "ADMIN" ? "Revoke admin" : "Make admin"}
      </button>
      {state.errors?.form && <span className="text-[0.7rem] text-[#ff9aa2]">{state.errors.form}</span>}
      {state.message && <span className="text-[0.7rem] text-[#8ff0c2]">{state.message}</span>}
    </form>
  );
}
