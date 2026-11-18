import { ShieldHalf } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { AdminNav } from "@/components/admin/AdminNav";

/**
 * Admin console shell. The layout checks the role too, but every page and every server
 * action calls requireAdmin() itself; the layout is never the only protection.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin("/admin");
  return (
    <div className="shell-container space-y-6 py-6 sm:py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="inline-flex items-center gap-2 text-[0.65rem] font-bold uppercase tracking-[0.3em] text-gold">
          <ShieldHalf className="h-4 w-4" /> Admin console
        </p>
        <p className="text-xs text-subtle">
          Signed in as <span className="text-ivory">@{admin.username}</span> · every change is audited
        </p>
      </div>
      <AdminNav />
      {children}
    </div>
  );
}
