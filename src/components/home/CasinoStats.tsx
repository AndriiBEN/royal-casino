import { Coins, Dices, Gamepad2, Percent, Trophy, Users, type LucideIcon } from "lucide-react";
import { CountUp } from "@/components/ui/CountUp";
import { RevealGroup, RevealItem } from "@/components/ui/Reveal";
import { cn } from "@/lib/utils";

type Stats = {
  players: number;
  rounds: number;
  wagered: number;
  paidOut: number;
  biggestWin: number;
  biggestWinGame: string | null;
  games: number;
  averageRtp: number;
};

/** Live statistics computed from the local database. */
export function CasinoStats({ stats, className }: { stats: Stats; className?: string }) {
  const items: { icon: LucideIcon; label: string; value: React.ReactNode; hint?: string }[] = [
    { icon: Users, label: "Members", value: <CountUp value={stats.players} /> },
    { icon: Dices, label: "Rounds played", value: <CountUp value={stats.rounds} /> },
    {
      icon: Coins,
      label: "Credits paid out",
      value: <CountUp value={stats.paidOut} format="compactCredits" />,
      hint: stats.wagered ? `of ${new Intl.NumberFormat("en-US", { notation: "compact" }).format(stats.wagered / 100)} wagered` : undefined,
    },
    {
      icon: Trophy,
      label: "Biggest win",
      value: <CountUp value={stats.biggestWin} format="compactCredits" />,
      hint: stats.biggestWinGame ?? undefined,
    },
    { icon: Gamepad2, label: "Original games", value: <CountUp value={stats.games} /> },
    { icon: Percent, label: "Average RTP", value: <CountUp value={stats.averageRtp} format="percent" /> },
  ];

  return (
    <RevealGroup
      className={cn(
        "grid grid-cols-2 gap-px overflow-hidden rounded-[1.75rem] border border-line bg-line md:grid-cols-3 xl:grid-cols-6 [&>*]:bg-surface",
        className,
      )}
      stagger={0.05}
    >
      {items.map(({ icon: Icon, label, value, hint }) => (
        <RevealItem key={label} className="group relative p-5 transition-colors hover:bg-surface-2 sm:p-6">
          <span aria-hidden className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-gold/0 to-transparent transition-all duration-500 group-hover:via-gold/70" />
          <Icon className="h-5 w-5 text-gold" />
          <p className="mt-4 font-display text-3xl font-bold text-ivory sm:text-4xl">{value}</p>
          <p className="mt-1 text-[0.65rem] font-bold uppercase tracking-[0.2em] text-subtle">{label}</p>
          {hint && <p className="mt-1 truncate text-xs text-muted">{hint}</p>}
        </RevealItem>
      ))}
    </RevealGroup>
  );
}
