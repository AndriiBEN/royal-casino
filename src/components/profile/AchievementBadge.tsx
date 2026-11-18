import { Lock } from "lucide-react";
import { RARITY_STYLE } from "@/lib/achievements";
import type { AchievementView } from "@/lib/profile/stats";
import { cn, formatNumber } from "@/lib/utils";
import { ICONS } from "./Avatar";

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });

export function AchievementBadge({ a }: { a: AchievementView }) {
  const r = RARITY_STYLE[a.rarity];
  const Icon = ICONS[a.icon] ?? ICONS.trophy;
  const unlocked = !!a.unlockedAt;
  const pct = Math.round((a.current / a.target) * 100);
  return (
    <li
      className={cn(
        "group relative flex flex-col items-center rounded-2xl border p-4 text-center transition-all",
        unlocked ? "border-line bg-surface hover:-translate-y-0.5 hover:border-gold/40" : "border-line/60 bg-ink/40",
      )}
    >
      <span
        className={cn("relative grid h-16 w-16 place-items-center [clip-path:polygon(50%_0,93%_25%,93%_75%,50%_100%,7%_75%,7%_25%)]", !unlocked && "opacity-40 grayscale")}
        style={{ background: unlocked ? `linear-gradient(160deg, ${r.ring}, #151515 120%)` : "#2a2a2e" }}
      >
        <span className="absolute inset-[3px] grid place-items-center bg-ink/85 [clip-path:polygon(50%_0,93%_25%,93%_75%,50%_100%,7%_75%,7%_25%)]">
          {unlocked ? <Icon className="h-6 w-6" style={{ color: r.text }} strokeWidth={1.8} /> : <Lock className="h-5 w-5 text-subtle" />}
        </span>
      </span>
      <p className={cn("mt-3 text-sm font-semibold", unlocked ? "text-ivory" : "text-muted")}>{a.title}</p>
      <p className="mt-0.5 text-[0.7rem] leading-snug text-subtle">{a.description}</p>
      <p className="mt-2 text-[0.6rem] font-bold uppercase tracking-[0.18em]" style={{ color: unlocked ? r.text : undefined }}>
        {r.label}
      </p>
      {unlocked ? (
        <p className="mt-1 text-[0.65rem] text-subtle">Unlocked {dateFmt.format(a.unlockedAt!)}</p>
      ) : (
        <div className="mt-2 w-full" aria-label={`${formatNumber(a.current)} of ${formatNumber(a.target)}`}>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-gold/60" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1 text-[0.6rem] tabular-nums text-subtle">
            {formatNumber(a.current)} / {formatNumber(a.target)}
          </p>
        </div>
      )}
    </li>
  );
}
