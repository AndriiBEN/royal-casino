import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Tone = "gold" | "ruby" | "jade" | "neutral" | "solid";

const tones: Record<Tone, string> = {
  gold: "border-gold/40 bg-gold/10 text-gold-light",
  ruby: "border-ruby/40 bg-ruby/15 text-[#ff9aa2]",
  jade: "border-jade/40 bg-jade/15 text-[#8ff0c2]",
  neutral: "border-line-strong bg-white/5 text-muted",
  solid: "border-transparent bg-gold-gradient text-ink",
};

export function Badge({
  tone = "gold",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-[0.14em]",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}

/** Green pulsing dot used for "live" / "online" indicators. */
export function LiveDot({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block h-2 w-2 rounded-full bg-jade animate-pulse-gold", className)}
    />
  );
}
