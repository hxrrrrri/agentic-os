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
    <div className="page-enter space-y-3">
      <div>
        <div className="terminal-label">Local Memory Vault</div>
        <h1 className="mt-1 text-3xl font-black tracking-[0.12em]">VAULT</h1>
        <div className="mt-1 truncate text-[0.78rem] text-[#8d877e]">{agenticosConfig.vaultPath}</div>
      </div>
      <div className="grid gap-3 xl:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader><CardTitle>File Browser</CardTitle><Badge>{files.length} entries</Badge></CardHeader>
          <div className="divide-y divide-[#2a302c] border border-[#2a302c] bg-[#080a09]">
            {files.map((file) => (
              <div
                key={file.path}
                className="grid grid-cols-[1fr_auto_auto] items-center gap-3 px-2.5 py-1.5 text-[0.7rem] hover:bg-[#0d1010]"
              >
                <span className="truncate text-[#f4f1e8]">{file.path}</span>
                <span className="text-[0.6rem] uppercase tracking-[0.12em] text-[#6f6a61]">{file.type}</span>
                <span className="text-[0.6rem] text-[#6f6a61]">{formatTime(file.updatedAt)}</span>
              </div>
            ))}
            {!files.length ? (
              <div className="px-3 py-2 text-xs text-[#6f6a61]">No files in this folder.</div>
            ) : null}
          </div>
        </Card>
        <aside className="space-y-3">
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
          {recent.length ? (
            <Card>
              <CardHeader><CardTitle>Recent Files</CardTitle><Badge>{recent.length}</Badge></CardHeader>
              <div className="divide-y divide-[#1d231f] border border-[#2a302c] bg-[#080a09]">
                {recent.map((file) => (
                  <div key={file.path} className="truncate px-2 py-1 text-[0.66rem] text-[#a8a29a] hover:bg-[#0d1010]">
                    {file.path}
                  </div>
                ))}
              </div>
            </Card>
          ) : null}
          {memory.length ? (
            <Card>
              <CardHeader><CardTitle>Memory Index</CardTitle><Badge>{memory.length}</Badge></CardHeader>
              <div className="divide-y divide-[#1d231f] border border-[#2a302c] bg-[#080a09]">
                {memory.map((item) => (
                  <div key={item.id} className="px-2 py-1.5 text-[0.66rem] hover:bg-[#0d1010]">
                    <div className="truncate text-[#f4f1e8]">{item.title}</div>
                    <div className="truncate text-[0.6rem] text-[#6f6a61]">{item.summary}</div>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
