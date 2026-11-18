"use client";

import { useActionState, useState } from "react";
import { Loader2, Lock } from "lucide-react";
import { setAvatar, setPrivacy } from "@/lib/actions/account";
import type { FormState } from "@/lib/actions/types";
import { AVATARS } from "@/lib/avatars";
import { tierStyle } from "@/lib/vip";
import { Button } from "@/components/ui/Button";
import { FormError, FormSuccess } from "@/components/ui/Field";
import { cn } from "@/lib/utils";
import { Avatar } from "./Avatar";

/** Avatar chooser. Tier-locked presets are shown but disabled; the server re-checks the tier. */
export function AvatarPicker({ current, tierLevel }: { current: string; tierLevel: number }) {
  const [state, action, pending] = useActionState<FormState, FormData>(setAvatar, {});
  const [choice, setChoice] = useState(current);
  return (
    <form action={action} className="space-y-5">
      <FormError message={state.errors?.form} />
      <div className="flex items-center gap-5">
        <Avatar avatar={choice} tierLevel={tierLevel} size="lg" />
        <p className="text-sm text-muted">Your avatar appears in the header and on your profile. Its ring shows your VIP tier.</p>
      </div>
      <fieldset>
        <legend className="sr-only">Choose an avatar</legend>
        <div className="grid grid-cols-4 gap-3 sm:grid-cols-7">
          {AVATARS.map((a) => {
            const locked = a.minLevel > tierLevel;
            return (
              <label
                key={a.id}
                className={cn(
                  "group relative flex cursor-pointer flex-col items-center gap-1.5 rounded-2xl border p-2 text-center transition-colors",
                  choice === a.id ? "border-gold bg-gold/10" : "border-line hover:border-gold/40",
                  locked && "cursor-not-allowed opacity-50 hover:border-line",
                )}
                title={locked ? `Unlocks at ${tierStyle(a.minLevel).name}` : a.label}
              >
                <input type="radio" name="avatar" value={a.id} checked={choice === a.id} disabled={locked} onChange={() => setChoice(a.id)} className="sr-only" />
                <Avatar avatar={a.id} tierLevel={1} size="sm" label={a.label} className={cn(locked && "grayscale")} />
                <span className="w-full truncate text-[0.65rem] text-muted">{a.label}</span>
                {locked && (
                  <span className="absolute right-1.5 top-1.5 flex items-center gap-0.5 rounded-full bg-ink/90 px-1.5 py-0.5 text-[0.55rem] font-bold" style={{ color: tierStyle(a.minLevel).text }}>
                    <Lock className="h-2.5 w-2.5" /> {tierStyle(a.minLevel).name}
                  </span>
                )}
              </label>
            );
          })}
        </div>
      </fieldset>
      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" variant="outline" disabled={pending || choice === current}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          Save avatar
        </Button>
        <FormSuccess message={state.message} />
      </div>
    </form>
  );
}

export function PrivacyForm({ showOnWinners }: { showOnWinners: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(setPrivacy, {});
  const [on, setOn] = useState(showOnWinners);
  return (
    <form action={action} className="space-y-4">
      <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-line bg-ink/40 p-4">
        <span>
          <span className="block text-sm font-semibold text-ivory">Show me on the winners board</span>
          <span className="mt-0.5 block text-xs text-muted">Big wins appear on the homepage with your display name. Turn this off to stay anonymous.</span>
        </span>
        <input type="checkbox" name="showOnWinners" checked={on} onChange={(e) => setOn(e.target.checked)} className="peer sr-only" />
        <span aria-hidden className={cn("relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-gold", on ? "bg-gold" : "bg-white/15")}>
          <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-ink shadow transition-all", on ? "left-[1.375rem]" : "left-0.5")} />
        </span>
      </label>
      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" variant="outline" size="sm" disabled={pending || on === showOnWinners}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          Save privacy
        </Button>
        <FormSuccess message={state.message} />
      </div>
    </form>
  );
}
