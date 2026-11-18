import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { adminMetadata } from "@/lib/admin/meta";
import { prisma } from "@/lib/db";
import { listAudit } from "@/lib/admin/queries";
import { parseConfig, type Engine } from "@/lib/games/config";
import { GameForm } from "@/components/admin/GameForms";
import { AuditTable } from "@/components/admin/AuditTable";
import { Panel } from "@/components/admin/ui";

export const generateMetadata = () => adminMetadata("Edit game");

type Props = { params: Promise<{ id: string }> };

export default async function AdminGameEdit({ params }: Props) {
  await requireAdmin("/admin/games");
  const id = z.string().min(1).max(40).safeParse((await params).id);
  if (!id.success) notFound();
  const game = await prisma.game.findUnique({ where: { id: id.data } });
  if (!game) notFound();
  const history = await listAudit({ scope: "admin", action: "admin.game_update", q: `"game":"${game.slug}"`, page: 1, pageSize: 15 });

  return (
    <div className="space-y-6">
      <Link href="/admin/games" className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.16em] text-muted hover:text-gold">
        <ChevronLeft className="h-4 w-4" /> All games
      </Link>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_1fr]">
        <Panel title={game.name} description={`${game.engine} · ${game.category} · /games/${game.slug}`}>
          <div className="p-5">
            <GameForm game={{ ...game, config: parseConfig(game.engine as Engine, game.config) }} />
          </div>
        </Panel>
        <Panel title="Change history" description="Every admin change to this game">
          <AuditTable rows={history.rows} compact />
        </Panel>
      </div>
    </div>
  );
}
