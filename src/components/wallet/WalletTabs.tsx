"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowDownToLine, LayoutGrid, ReceiptText } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/wallet", label: "Overview", icon: LayoutGrid },
  { href: "/wallet/deposit", label: "Demo deposit", icon: ArrowDownToLine },
  { href: "/wallet/history", label: "History", icon: ReceiptText },
] as const;

export function WalletTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Wallet" className="scrollbar-none -mx-1 flex gap-1 overflow-x-auto rounded-full border border-line bg-surface p-1">
      {TABS.map(({ href, label, icon: Icon }) => {
        const active = href === "/wallet" ? pathname === "/wallet" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors sm:px-5",
              active ? "text-ink" : "text-muted hover:text-ivory",
            )}
          >
            {active && (
              <motion.span layoutId="wallet-tab" className="absolute inset-0 rounded-full bg-gold-gradient" transition={{ type: "spring", stiffness: 420, damping: 34 }} />
            )}
            <Icon className="relative h-4 w-4" />
            <span className="relative">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
