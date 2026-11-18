"use client";

import Link from "next/link";
import Form from "next/form";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { LogIn, LogOut, Menu, Search, ShieldHalf, UserPlus, Wallet, X } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { Input } from "@/components/ui/Input";
import { ButtonLink } from "@/components/ui/Button";
import { SidebarNav, type SidebarData } from "./SidebarNav";
import { MAIN_NAV, isActive } from "@/lib/navigation";
import { logout } from "@/lib/actions/auth";
import { SoundMenu } from "@/components/ui/SoundSettings";
import { cn, formatCredits } from "@/lib/utils";
import { Avatar } from "@/components/profile/Avatar";

export type HeaderPlayer = {
  displayName: string;
  username: string;
  balance: number;
  tierName: string;
  tierLevel: number;
  avatar: string;
  /** Display hint only. The /admin route enforces the role on the server. */
  isAdmin: boolean;
} | null;

function SearchForm({ className, autoFocus }: { className?: string; autoFocus?: boolean }) {
  const params = useSearchParams();
  const pathname = usePathname();
  const current = pathname === "/games" ? params.get("q") ?? "" : "";
  return (
    <Form action="/games" className={className} role="search">
      <Input
        key={current}
        name="q"
        type="search"
        defaultValue={current}
        autoFocus={autoFocus}
        placeholder="Search games or studios"
        aria-label="Search games"
        icon={<Search className="h-4 w-4" />}
        maxLength={60}
      />
    </Form>
  );
}

/** Virtual balance pill; links to the wallet. */
function BalancePill({ balance }: { balance: number }) {
  return (
    <Link
      href="/wallet"
      className="group flex h-11 items-center gap-2.5 rounded-full border border-gold/30 bg-surface/80 pl-1.5 pr-3 transition-all hover:border-gold/70 hover:shadow-[0_0_24px_-8px_rgb(212_175_98/0.7)] sm:pr-4"
      aria-label={`Demo balance ${formatCredits(balance)} virtual credits. Open wallet`}
    >
      <span className="grid h-8 w-8 place-items-center rounded-full bg-gold-gradient text-ink">
        <Wallet className="h-4 w-4" />
      </span>
      <span className="flex flex-col leading-none">
        <span className="hidden text-[0.55rem] font-bold uppercase tracking-[0.22em] text-subtle sm:block">
          Demo balance
        </span>
        <span className="text-sm font-bold tabular-nums text-gold-light sm:mt-1">
          <span className="sm:hidden">{formatCredits(balance, { compact: true })}</span>
          <span className="hidden sm:inline">{formatCredits(balance)}</span>
        </span>
      </span>
    </Link>
  );
}

export function Header({ player, sidebar }: { player: HeaderPlayer; sidebar: SidebarData }) {
  const [drawer, setDrawer] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const params = useSearchParams();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close overlays on navigation
  useEffect(() => {
    setDrawer(false);
    setSearchOpen(false);
  }, [pathname, params]);

  useEffect(() => {
    document.body.style.overflow = drawer ? "hidden" : "";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && (setDrawer(false), setSearchOpen(false));
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [drawer]);

  const loginHref = pathname === "/login" || pathname === "/register" ? "/login" : `/login?next=${encodeURIComponent(pathname)}`;

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-30 h-[var(--header-h)] border-b transition-all duration-300",
          scrolled
            ? "border-line bg-ink/85 shadow-[0_10px_30px_-20px_rgb(0_0_0/0.9)] backdrop-blur-xl"
            : "border-transparent bg-ink/40 backdrop-blur-sm",
        )}
      >
        <div className="shell-container flex h-full items-center gap-3">
          <button
            type="button"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-line text-ivory transition-colors hover:border-gold/50 hover:text-gold lg:hidden"
            onClick={() => setDrawer(true)}
            aria-label="Open menu"
            aria-expanded={drawer}
          >
            <Menu className="h-5 w-5" />
          </button>

          <Logo className="sm:hidden" compact />
          <Logo className="hidden sm:flex lg:hidden" />

          <nav className="hidden items-center gap-0.5 xl:flex" aria-label="Main">
            {MAIN_NAV.map((item) => {
              const active = isActive(item, pathname, params);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative rounded-full px-3.5 py-2 text-[0.8rem] font-semibold tracking-wide transition-colors 2xl:px-4",
                    active ? "text-gold-light" : "text-muted hover:text-ivory",
                  )}
                >
                  {item.label}
                  {active && (
                    <motion.span layoutId="header-active" className="absolute inset-x-3.5 -bottom-0.5 h-px bg-gold" />
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <SearchForm className="hidden w-64 2xl:block" />
            <button
              type="button"
              onClick={() => setSearchOpen((v) => !v)}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-line text-muted transition-colors hover:border-gold/50 hover:text-gold 2xl:hidden"
              aria-label={searchOpen ? "Close search" : "Open search"}
              aria-expanded={searchOpen}
            >
              {searchOpen ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
            </button>
            <SoundMenu signedIn={!!player} />

            {player ? (
              <>
                {player.isAdmin && (
                  <Link
                    href="/admin"
                    aria-label="Admin console"
                    title="Admin console"
                    className={cn(
                      "hidden h-10 items-center gap-2 rounded-full border px-3.5 text-xs font-bold uppercase tracking-[0.16em] transition-colors md:flex",
                      pathname.startsWith("/admin")
                        ? "border-gold bg-gold/15 text-gold-light"
                        : "border-gold/30 text-gold hover:border-gold/70",
                    )}
                  >
                    <ShieldHalf className="h-4 w-4" />
                    <span className="hidden 2xl:inline">Admin</span>
                  </Link>
                )}
                <BalancePill balance={player.balance} />
                <Link
                  href="/profile"
                  className="group hidden items-center gap-3 rounded-full border border-line py-1 pl-1 pr-4 transition-colors hover:border-gold/50 md:flex"
                  aria-label={`${player.displayName}, ${player.tierName} tier. Open profile`}
                >
                  <Avatar avatar={player.avatar} tierLevel={player.tierLevel} size="xs" />
                  <span className="hidden flex-col leading-tight lg:flex">
                    <span className="max-w-28 truncate text-xs font-semibold text-ivory">{player.displayName}</span>
                    <span className="text-[0.6rem] font-bold uppercase tracking-[0.2em] text-gold">{player.tierName}</span>
                  </span>
                </Link>
              </>
            ) : (
              <>
                <ButtonLink href={loginHref} variant="outline" size="sm" className="h-10 px-3.5 sm:px-5">
                  <LogIn className="h-4 w-4 sm:hidden" />
                  <span className="hidden sm:inline">Login</span>
                  <span className="sr-only sm:hidden">Login</span>
                </ButtonLink>
                <ButtonLink href="/register" size="sm" className="h-10 px-4 sm:px-5">
                  Register
                </ButtonLink>
              </>
            )}
          </div>
        </div>

        <AnimatePresence>
          {searchOpen && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="absolute inset-x-0 top-full border-b border-line bg-ink/95 py-3 backdrop-blur-xl 2xl:hidden"
            >
              <div className="shell-container">
                <SearchForm autoFocus className="mx-auto max-w-2xl" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Mobile drawer */}
      <AnimatePresence>
        {drawer && (
          <>
            <motion.div
              key="scrim"
              className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDrawer(false)}
            />
            <motion.aside
              key="drawer"
              role="dialog"
              aria-modal="true"
              aria-label="Main menu"
              className="fixed inset-y-0 left-0 z-50 flex w-[min(20rem,86vw)] flex-col border-r border-gold/20 bg-ink-2 lg:hidden"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 38 }}
            >
              <div className="flex h-[var(--header-h)] shrink-0 items-center justify-between px-5">
                <Logo />
                <button
                  type="button"
                  onClick={() => setDrawer(false)}
                  aria-label="Close menu"
                  className="grid h-10 w-10 place-items-center rounded-full border border-line text-muted hover:text-gold"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="gold-divider mx-5 opacity-60" />

              <div className="px-4 pt-5">
                {player ? (
                  <div className="flex items-center gap-3 rounded-2xl border border-gold/25 bg-surface p-3">
                    <Avatar avatar={player.avatar} tierLevel={player.tierLevel} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ivory">{player.displayName}</p>
                      <p className="text-xs tabular-nums text-gold-light">{formatCredits(player.balance)} credits</p>
                    </div>
                    <form action={logout}>
                      <button
                        type="submit"
                        aria-label="Log out"
                        className="grid h-9 w-9 place-items-center rounded-full border border-line text-muted hover:border-ruby/50 hover:text-[#ff9aa2]"
                      >
                        <LogOut className="h-4 w-4" />
                      </button>
                    </form>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <ButtonLink href={loginHref} variant="outline" size="sm" className="h-11">
                      <LogIn className="h-4 w-4" />
                      Login
                    </ButtonLink>
                    <ButtonLink href="/register" size="sm" className="h-11">
                      <UserPlus className="h-4 w-4" />
                      Register
                    </ButtonLink>
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-6">
                <SidebarNav data={sidebar} idPrefix="drawer" onNavigate={() => setDrawer(false)} />
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
