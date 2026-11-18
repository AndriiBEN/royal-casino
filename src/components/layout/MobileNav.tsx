"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { MAIN_NAV, isActive } from "@/lib/navigation";
import { cn } from "@/lib/utils";

const SHORT: Record<string, string> = { "VIP Club": "VIP" };

/** Bottom tab bar for phones and tablets: Home, Games, VIP, Wallet, Profile. */
export function MobileNav() {
  const pathname = usePathname();
  const params = useSearchParams();

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-gold/15 bg-ink/90 pb-[env(safe-area-inset-bottom)] shadow-[0_-12px_30px_-12px_rgb(0_0_0/0.9)] backdrop-blur-xl lg:hidden"
    >
      <ul className="mx-auto grid h-16 max-w-lg grid-cols-5">
        {MAIN_NAV.map((item) => {
          const active = isActive(item, pathname, params);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex h-full flex-col items-center justify-center gap-1 text-[0.62rem] font-semibold uppercase tracking-[0.12em] transition-colors",
                  active ? "text-gold" : "text-subtle hover:text-ivory",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="tab-active"
                    className="absolute top-0 h-0.5 w-8 rounded-b-full bg-gold shadow-[0_0_10px_rgb(212_175_98/0.8)]"
                  />
                )}
                <Icon className={cn("h-5 w-5 transition-transform", active && "-translate-y-0.5")} />
                {SHORT[item.label] ?? item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
