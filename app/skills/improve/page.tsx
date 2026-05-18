"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, Sparkles, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";

interface Grade { id: string; runId: string; skillId?: string; score: number; rubric: Record<string, number>; notes?: string; createdAt: string }
interface Patch { id: string; skillId: string; version: number; patchPrompt: string; basedOnRunIds: string[]; createdAt: string; adopted: boolean }

export default function SkillImprovePage() {
  const [grades, setGrades]   = useState<Grade[]>([]);
  const [patches, setPatches] = useState<Patch[]>([]);
  const [busy, setBusy]       = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/skills/improve", { cache: "no-store" });
    const data = (await res.json()) as { grades: Grade[]; patches: Patch[] };
    setGrades(data.grades); setPatches(data.patches);
  }, []);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  const adopt = async (patchId: string) => {
    setBusy(true);
    await fetch("/api/skills/improve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ patchId }) });
    setBusy(false); await load();
  };

  const skillAverages = grades.reduce<Record<string, { sum: number; count: number }>>((acc, g) => {
    const key = g.skillId ?? "_unknown";
    acc[key] ??= { sum: 0, count: 0 };
    acc[key].sum += g.score;
    acc[key].count += 1;
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div>
        <div className="terminal-label">Self-improvement</div>
        <h1 className="mt-2 text-3xl font-black tracking-[0.12em]">SKILL LOOP</h1>
        <p className="mt-2 text-xs text-[#a8a29a]">Each completed run is auto-graded. After 5+ high-graded runs per skill, AgenticOS distills a refined prompt patch for review.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Per-skill quality (last 30 runs)</CardTitle>
          <Badge tone="green">{Object.keys(skillAverages).length} skills</Badge>
        </CardHeader>
        <div className="grid gap-2 md:grid-cols-2">
          {Object.entries(skillAverages).map(([skill, { sum, count }]) => {
            const avg = sum / count;
            return (
              <div key={skill} className="flex items-center gap-2 border border-[#2a302c] bg-[#080a09] p-3 text-xs">
                <TrendingUp size={11} className={avg >= 0.75 ? "text-[#79a875]" : "text-[#6f6a61]"} />
                <span className="text-sm font-bold text-[#f4f1e8]">{skill}</span>
                <Badge tone={avg >= 0.75 ? "green" : avg >= 0.5 ? "orange" : "yellow"}>{(avg * 10).toFixed(1)}/10</Badge>
                <span className="ml-auto text-[#6f6a61]">{count} graded</span>
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Distilled skill patches</CardTitle>
          <Badge tone="green">{patches.length}</Badge>
        </CardHeader>
        <div className="space-y-2">
          {patches.length === 0 ? <div className="border border-dashed border-[#2a302c] p-4 text-center text-xs text-[#6f6a61]">No patches yet — keep running skills; patches appear once each skill has 5+ high-graded runs.</div> : null}
          {patches.map((p) => (
            <div key={p.id} className="space-y-2 border border-[#2a302c] bg-[#080a09] p-3 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold text-[#f4f1e8]">{p.skillId} <span className="text-[#6f6a61]">v{p.version}</span></span>
                {p.adopted ? <Badge tone="green"><Check size={9} /> adopted</Badge> : <Badge tone="orange"><Sparkles size={9} /> pending</Badge>}
                <Badge>{p.basedOnRunIds.length} runs</Badge>
                <span className="ml-auto text-[#6f6a61]">{new Date(p.createdAt).toLocaleString()}</span>
              </div>
              <pre className="max-h-48 overflow-auto whitespace-pre-wrap border border-[#2a302c] bg-[#10120f] p-2 thin-scrollbar text-[#f4f1e8]">{p.patchPrompt}</pre>
              {!p.adopted ? (
                <Button type="button" onClick={() => void adopt(p.id)} disabled={busy}>
                  {busy ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} Adopt
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent grades</CardTitle>
          <Badge>{grades.length}</Badge>
        </CardHeader>
        <div className="space-y-1 text-xs">
          {grades.slice(0, 20).map((g) => (
            <div key={g.id} className="flex flex-wrap items-center gap-2 border border-[#2a302c] bg-[#080a09] px-2 py-1">
              <Badge tone={g.score >= 0.75 ? "green" : g.score >= 0.5 ? "orange" : "yellow"}>{(g.score * 10).toFixed(1)}</Badge>
              {g.skillId ? <Badge>{g.skillId}</Badge> : null}
              <span className="text-[#a8a29a]">run {g.runId.slice(-8)}</span>
              {g.notes ? <span className="ml-auto truncate text-[#6f6a61]">{g.notes}</span> : null}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
