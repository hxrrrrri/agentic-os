import { CreateNote } from "@/components/vault/create-note";
import { GraphStatsCard } from "@/components/vault/graph-stats";
import { BacklinksPanel } from "@/components/vault/backlinks-panel";
import { PromotionPanel } from "@/components/vault/promotion-panel";
import { ConflictPanel } from "@/components/vault/conflict-panel";
import { PatternsPanel } from "@/components/vault/patterns-panel";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { agenticosConfig } from "@/agenticos.config";
import { getBacklinks, getGraphStats, getOutlinks, getPromotionCandidates, listMemoryItems } from "@/lib/db/repositories";
import { detectConflicts } from "@/lib/vault/conflict";
import { formatTime } from "@/lib/utils";
import { listVaultFiles, getRecentVaultFiles } from "@/lib/vault/service";

export const dynamic = "force-dynamic";

export default async function VaultPage({ searchParams }: { searchParams: Promise<{ path?: string }> }) {
  const params = await searchParams;
  const notePath = params.path ?? "";
  const [files, recent, memory, graphStats, backlinks, outlinks, promotionCandidates, conflicts] = await Promise.all([
    listVaultFiles(notePath),
    getRecentVaultFiles(12),
    listMemoryItems(20),
    getGraphStats(),
    notePath ? getBacklinks(notePath) : Promise.resolve([]),
    notePath ? getOutlinks(notePath) : Promise.resolve([]),
    getPromotionCandidates(),
    detectConflicts().catch(() => []),
  ]);
  return (
    <div className="space-y-4">
      <div>
        <div className="terminal-label">Local Memory Vault</div>
        <h1 className="mt-2 text-3xl font-black tracking-[0.12em]">VAULT</h1>
        <div className="mt-2 text-xs text-[#6f6a61]">{agenticosConfig.vaultPath}</div>
      </div>
      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <Card>
          <CardHeader><CardTitle>File Browser</CardTitle><Badge>{files.length} entries</Badge></CardHeader>
          <div className="grid gap-2">
            {files.map((file) => (
              <div key={file.path} className="grid grid-cols-[1fr_auto_auto] gap-3 border border-[#2a302c] bg-[#080a09] p-3 text-xs">
                <span className="truncate text-[#f4f1e8]">{file.path}</span>
                <span className="text-[#6f6a61]">{file.type}</span>
                <span className="text-[#6f6a61]">{formatTime(file.updatedAt)}</span>
              </div>
            ))}
          </div>
        </Card>
        <aside className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Create Note</CardTitle></CardHeader>
            <CreateNote />
          </Card>
          <GraphStatsCard stats={graphStats} />
          {notePath && (backlinks.length > 0 || outlinks.length > 0) ? (
            <BacklinksPanel notePath={notePath} backlinks={backlinks} outlinks={outlinks} />
          ) : null}
          <PromotionPanel initial={promotionCandidates} />
          <ConflictPanel initial={conflicts} />
          <PatternsPanel initial={[]} />
          <Card>
            <CardHeader><CardTitle>Recent Files</CardTitle></CardHeader>
            <div className="space-y-2">{recent.map((file) => <div key={file.path} className="border border-[#2a302c] bg-[#080a09] p-2 text-xs text-[#a8a29a]">{file.path}</div>)}</div>
          </Card>
          <Card>
            <CardHeader><CardTitle>Memory Index</CardTitle></CardHeader>
            <div className="space-y-2">{memory.map((item) => <div key={item.id} className="border border-[#2a302c] bg-[#080a09] p-2 text-xs"><div className="text-[#f4f1e8]">{item.title}</div><div className="mt-1 text-[#6f6a61]">{item.summary}</div></div>)}</div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
