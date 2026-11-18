import {
  CalendarCheck,
  Castle,
  Club,
  Compass,
  Crown,
  Diamond,
  Dices,
  Feather,
  Flame,
  Gem,
  Gift,
  Heart,
  Infinity as InfinityIcon,
  Layers,
  Medal,
  Moon,
  Play,
  Repeat,
  Spade,
  Sparkles,
  Star,
  Sun,
  Swords,
  Target,
  TrendingUp,
  Trophy,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { avatarById } from "@/lib/avatars";
import { tierStyle } from "@/lib/vip";
import { cn } from "@/lib/utils";

/** Icon names used by avatars and achievements. */
export const ICONS: Record<string, LucideIcon> = {
  crown: Crown,
  spade: Spade,
  heart: Heart,
  club: Club,
  diamond: Diamond,
  star: Star,
  moon: Moon,
  dices: Dices,
  flame: Flame,
  feather: Feather,
  castle: Castle,
  swords: Swords,
  sun: Sun,
  gem: Gem,
  play: Play,
  repeat: Repeat,
  infinity: InfinityIcon,
  compass: Compass,
  "trending-up": TrendingUp,
  zap: Zap,
  layers: Layers,
  target: Target,
  trophy: Trophy,
  sparkles: Sparkles,
  gift: Gift,
  "calendar-check": CalendarCheck,
  medal: Medal,
};

const SIZES = {
  xs: "h-9 w-9 p-[2px]",
  sm: "h-12 w-12 p-[2px]",
  md: "h-16 w-16 p-[3px]",
  lg: "h-24 w-24 p-[3px]",
  xl: "h-32 w-32 p-1",
};

/**
 * Player avatar: a preset medallion inside a ring coloured by VIP tier.
 * Diamond members get an animated sheen on the ring.
 */
export function Avatar({ avatar, tierLevel = 1, size = "md", label, className }: { avatar: string; tierLevel?: number; size?: keyof typeof SIZES; label?: string; className?: string }) {
  const preset = avatarById(avatar);
  const tier = tierStyle(tierLevel);
  const Icon = ICONS[preset.icon] ?? Crown;
  return (
    <span
      role="img"
      aria-label={label ?? `${preset.label} avatar, ${tier.name} tier`}
      className={cn("relative inline-grid shrink-0 rounded-full", SIZES[size], tierLevel >= 5 && "animate-[spin_8s_linear_infinite] motion-reduce:animate-none", className)}
      style={{ background: `conic-gradient(from 0deg, ${tier.from}, ${tier.to}, ${tier.from}, ${tier.to}, ${tier.from})` }}
    >
      <span
        className={cn("grid h-full w-full place-items-center rounded-full shadow-[inset_0_2px_6px_rgb(255_255_255/0.25),inset_0_-6px_12px_rgb(0_0_0/0.45)]", tierLevel >= 5 && "animate-[spin_8s_linear_infinite_reverse] motion-reduce:animate-none")}
        style={{ background: `radial-gradient(circle at 35% 30%, ${preset.from}, ${preset.to})` }}
      >
        <Icon className="h-[46%] w-[46%] text-white drop-shadow-[0_2px_4px_rgb(0_0_0/0.5)]" strokeWidth={1.8} />
      </span>
    </span>
  );
}
