import { Logo } from "@/components/ui/Logo";
import { SidebarNav, type SidebarData } from "./SidebarNav";

/** Fixed desktop sidebar (lg and up). On smaller screens the same nav lives in the mobile drawer. */
export function Sidebar({ data }: { data: SidebarData }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[var(--sidebar-w)] flex-col border-r border-line bg-ink-2/95 backdrop-blur-xl lg:flex">
      <div className="flex h-[var(--header-h)] shrink-0 items-center px-6">
        <Logo />
      </div>
      <div className="gold-divider mx-6 opacity-60" />
      <div className="flex-1 overflow-y-auto px-4 py-6 [mask-image:linear-gradient(to_bottom,black_calc(100%-2.5rem),transparent)]">
        <SidebarNav data={data} />
      </div>
      <div className="border-t border-line px-6 py-4 text-[0.65rem] leading-relaxed text-subtle">
        <span className="mr-2 inline-grid h-6 w-6 place-items-center rounded-full border border-gold/40 text-[0.6rem] font-bold text-gold">
          18+
        </span>
        Play-money credits only. Please play responsibly.
      </div>
    </aside>
  );
}
