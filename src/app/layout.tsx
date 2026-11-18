import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Manrope } from "next/font/google";
import { Header, type HeaderPlayer } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { MobileNav } from "@/components/layout/MobileNav";
import { Footer } from "@/components/layout/Footer";
import { NavigationFeedback } from "@/components/layout/NavigationFeedback";
import type { SidebarData } from "@/components/layout/SidebarNav";
import { getCategoryCounts, getVipTiers } from "@/lib/queries";
import { getCurrentUser } from "@/lib/auth";
import { getTierProgress } from "@/lib/vip";
import { SITE } from "@/lib/constants";
import "./globals.css";

const display = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-cormorant",
  display: "swap",
});

const sans = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-manrope",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: `${SITE.name} | ${SITE.tagline}`, template: `%s | ${SITE.name}` },
  description: SITE.description,
  applicationName: SITE.name,
};

export const viewport: Viewport = {
  themeColor: "#0B0B0D",
  colorScheme: "dark",
};

// Session, balance, favourites and catalogue live in SQLite, so always render fresh.
export const dynamic = "force-dynamic";

async function loadShellData(): Promise<{ player: HeaderPlayer; sidebar: SidebarData }> {
  try {
    const [user, tiers, categoryCounts] = await Promise.all([
      getCurrentUser(),
      getVipTiers(),
      getCategoryCounts(),
    ]);
    return {
      // Only display fields cross into client components; no hashes, emails or ids.
      player:
        user && tiers.length
          ? {
              displayName: user.displayName,
              username: user.username,
              balance: user.wallet?.balance ?? 0,
              tierName: getTierProgress(user.vipPoints, tiers).current.name,
              tierLevel: getTierProgress(user.vipPoints, tiers).current.level,
              avatar: user.avatar,
              isAdmin: user.role === "ADMIN",
            }
          : null,
      sidebar: {
        categoryCounts,
        favoriteCount: user?.favorites.length ?? 0,
        isAdmin: user?.role === "ADMIN",
      },
    };
  } catch (err) {
    console.error("[royal-casino] Could not load shell data. Did you run `npm run setup`?", err);
    return { player: null, sidebar: { categoryCounts: {}, favoriteCount: 0, isAdmin: false } };
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { player, sidebar } = await loadShellData();

  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body>
        <a
          href="#main"
          className="fixed left-4 top-4 z-[100] -translate-y-24 rounded-full bg-gold px-4 py-2 text-sm font-bold text-ink transition-transform focus:translate-y-0"
        >
          Skip to content
        </a>
        <Sidebar data={sidebar} />
        <div className="flex min-h-dvh flex-col lg:pl-[var(--sidebar-w)]">
          <Header player={player} sidebar={sidebar} />
          <main id="main" className="flex-1 pb-24 lg:pb-0">
            {children}
            <NavigationFeedback />
          </main>
          <div className="pb-16 lg:pb-0">
            <Footer />
          </div>
        </div>
        <MobileNav />
      </body>
    </html>
  );
}
