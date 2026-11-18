import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { CATEGORIES } from "@/lib/constants";
import { RevealGroup, RevealItem } from "@/components/ui/Reveal";

export function CategoryTiles({ counts }: { counts: Record<string, number> }) {
  return (
    <RevealGroup className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {CATEGORIES.map((c, i) => {
        const Icon = c.icon;
        return (
          <RevealItem key={c.slug} className={i === 4 ? "col-span-2 sm:col-span-1" : undefined}>
            <Link
              href={`/games?category=${c.slug}`}
              className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-gold/40 hover:shadow-gold"
            >
              <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-gold/10 blur-2xl transition-opacity duration-500 group-hover:bg-gold/20" />
              <div className="relative flex items-start justify-between">
                <span className="grid h-11 w-11 place-items-center rounded-xl border border-gold/30 bg-ink text-gold transition-colors group-hover:bg-gold group-hover:text-ink">
                  <Icon className="h-5 w-5" />
                </span>
                <ArrowUpRight className="h-4 w-4 text-subtle transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-gold" />
              </div>
              <p className="relative mt-6 font-display text-2xl font-semibold text-ivory">{c.label}</p>
              <p className="relative mt-1 text-xs text-muted">{c.blurb}</p>
              <p className="relative mt-4 text-[0.65rem] font-bold uppercase tracking-[0.2em] text-gold/80">
                {counts[c.slug] ?? 0} games
              </p>
            </Link>
          </RevealItem>
        );
      })}
    </RevealGroup>
  );
}
