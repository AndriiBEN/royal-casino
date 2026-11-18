"use client";

import { useOptimistic, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import { toggleFavorite } from "@/lib/actions/account";
import { cn } from "@/lib/utils";

export function FavoriteButton({
  gameId,
  gameName,
  initial,
  variant = "overlay",
  className,
}: {
  gameId: string;
  gameName: string;
  initial: boolean;
  variant?: "overlay" | "full";
  className?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [favorited, setFavorited] = useOptimistic(initial);
  const router = useRouter();
  const pathname = usePathname();

  const onClick = () => {
    startTransition(async () => {
      setFavorited(!favorited);
      const res = await toggleFavorite({ gameId });
      if (!res.ok && res.error === "auth") router.push(`/login?next=${encodeURIComponent(pathname)}`);
    });
  };

  const label = favorited ? `Remove ${gameName} from favourites` : `Add ${gameName} to favourites`;

  if (variant === "full") {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={favorited}
        aria-label={label}
        disabled={pending}
        className={cn(
          "inline-flex h-11 items-center gap-2 rounded-full border px-6 text-sm font-semibold transition-all",
          favorited
            ? "border-ruby/50 bg-ruby/15 text-[#ff9aa2] hover:bg-ruby/25"
            : "border-gold/40 text-gold-light hover:border-gold hover:bg-gold/10",
          className,
        )}
      >
        <Heart className={cn("h-4 w-4 transition-transform", favorited && "scale-110 fill-current")} />
        {favorited ? "In favourites" : "Add to favourites"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={favorited}
      aria-label={label}
      title={label}
      className={cn(
        "grid h-9 w-9 place-items-center rounded-full border backdrop-blur-md transition-all duration-300",
        favorited
          ? "border-ruby/50 bg-ruby/25 text-[#ff9aa2]"
          : "border-white/15 bg-black/45 text-ivory/80 hover:border-gold/60 hover:text-gold",
        className,
      )}
    >
      <Heart className={cn("h-4 w-4 transition-transform", favorited && "scale-110 fill-current")} />
    </button>
  );
}
