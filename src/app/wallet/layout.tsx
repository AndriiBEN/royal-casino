import { DemoRibbon } from "@/components/wallet/Demo";
import { WalletTabs } from "@/components/wallet/WalletTabs";

/** Every wallet page carries the DEMO banner and the wallet tabs. Pages enforce auth themselves. */
export default function WalletLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell-container space-y-6 py-6 sm:py-8">
      <DemoRibbon />
      <WalletTabs />
      {children}
    </div>
  );
}
