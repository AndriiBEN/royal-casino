import Link from "next/link";
import { Lock, ShieldCheck, Sparkles } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { CATEGORIES, SITE } from "@/lib/constants";

const COLUMNS = [
  {
    title: "Casino",
    links: CATEGORIES.map((c) => ({ label: c.label, href: `/games?category=${c.slug}` })),
  },
  {
    title: "Account",
    links: [
      { label: "Wallet", href: "/wallet" },
      { label: "Profile", href: "/profile" },
      { label: "VIP Club", href: "/vip" },
      { label: "Promotions", href: "/promotions" },
      { label: "Favourites", href: "/games?favorites=1" },
    ],
  },
  {
    title: "Help",
    links: [
      { label: "Responsible gaming", href: "/responsible-gaming" },
      { label: "Setting limits", href: "/responsible-gaming#limits" },
      { label: "Questions", href: "/responsible-gaming#faq" },
      { label: "Support organisations", href: "/responsible-gaming#support" },
    ],
  },
];

const STUDIOS = ["Aurum Studios", "Noir & Gold", "Lantern Forge", "Maison Live", "Starlight Broadcast"];

export function Footer() {
  return (
    <footer className="relative mt-24 border-t border-line bg-ink-2/80">
      <div className="gold-divider absolute inset-x-0 top-0" />
      <div className="shell-container py-14">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div className="max-w-sm">
            <Logo />
            <p className="mt-5 text-sm leading-relaxed text-muted">{SITE.description}</p>
            <div className="mt-6 flex flex-wrap gap-2">
              {[
                { icon: ShieldCheck, label: "Fair-play RNG" },
                { icon: Lock, label: "Local and private" },
                { icon: Sparkles, label: "Original games" },
              ].map(({ icon: Icon, label }) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-[0.7rem] text-muted"
                >
                  <Icon className="h-3.5 w-3.5 text-gold" />
                  {label}
                </span>
              ))}
            </div>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h3 className="font-sans text-[0.7rem] font-bold uppercase tracking-[0.28em] text-gold">
                {col.title}
              </h3>
              <ul className="mt-5 space-y-3">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="text-sm text-muted transition-colors hover:text-gold-light">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 border-y border-line py-6">
          <p className="mb-4 text-center text-[0.62rem] font-bold uppercase tracking-[0.3em] text-subtle">
            House studios
          </p>
          <ul className="flex flex-wrap items-center justify-center gap-x-10 gap-y-3">
            {STUDIOS.map((s) => (
              <li key={s} className="font-display text-lg italic tracking-wide text-ivory/35">
                {s}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-8 flex flex-col items-center justify-between gap-6 text-center md:flex-row md:text-left">
          <div className="flex items-center gap-4">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 border-gold/60 font-bold text-gold">
              18+
            </span>
            <p className="max-w-xl text-xs leading-relaxed text-subtle">
              Royal Casino is a local entertainment app that uses play-money credits only. Credits have no cash
              value and cannot be bought, sold or withdrawn. If gambling stops being fun, visit our{" "}
              <Link href="/responsible-gaming" className="text-gold underline-offset-4 hover:underline">
                responsible gaming
              </Link>{" "}
              page.
            </p>
          </div>
          <p className="shrink-0 text-xs text-subtle">
            © {new Date().getFullYear()} {SITE.name}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
