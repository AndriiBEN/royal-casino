import type { Metadata } from "next";
import { Gift } from "lucide-react";
import { PromotionCard } from "@/components/promotions/PromotionCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { RevealGroup, RevealItem } from "@/components/ui/Reveal";
import { EmptyState } from "@/components/ui/EmptyState";
import { getPromotions } from "@/lib/queries";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Promotions" };

export default async function PromotionsPage() {
  const [promos, user] = await Promise.all([getPromotions(), getCurrentUser()]);

  return (
    <div className="shell-container space-y-8 py-6 sm:py-8">
      <PageHeader
        eyebrow="Offers & rewards"
        title={
          <>
            Promotions worthy of <span className="italic text-gold-gradient">the crown</span>
          </>
        }
        description="Welcome credits, a daily bonus that grows with your streak, free spins and progressive jackpots. Every reward is play money with no cash value."
        icon={Gift}
      />

      {promos.length ? (
        <RevealGroup className="grid gap-5 md:grid-cols-2">
          {promos.map((p) => (
            <RevealItem key={p.id}>
              <PromotionCard promo={p} detailed signedIn={!!user} />
            </RevealItem>
          ))}
        </RevealGroup>
      ) : (
        <EmptyState icon={Gift} title="No offers loaded" description="Load them with npm run db:promotions in the project folder, then refresh this page." />
      )}
    </div>
  );
}
