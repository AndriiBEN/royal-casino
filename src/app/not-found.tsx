import { Spade } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="shell-container flex min-h-[70dvh] items-center justify-center py-16">
      <div className="text-center">
        <div className="relative mx-auto mb-8 h-40 w-28 -rotate-6 rounded-2xl border-gold-gradient shadow-gold">
          <div className="bg-pattern-deco absolute inset-2 grid place-items-center rounded-xl border border-gold/20">
            <Spade className="h-10 w-10 text-gold" strokeWidth={1.3} />
          </div>
          <span className="absolute left-3 top-2 font-display text-xl font-bold text-gold">4</span>
          <span className="absolute bottom-2 right-3 rotate-180 font-display text-xl font-bold text-gold">4</span>
        </div>
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-gold">Error 404</p>
        <h1 className="mt-3 text-5xl text-ivory sm:text-6xl">This card was never dealt</h1>
        <p className="mx-auto mt-4 max-w-md text-muted">
          The page you are looking for has left the table. Head back to the lobby and pick another game.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <ButtonLink href="/">Back to lobby</ButtonLink>
          <ButtonLink href="/games" variant="outline">
            Browse games
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
