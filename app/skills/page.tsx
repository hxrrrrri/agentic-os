import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { listSkills } from "@/lib/skills/registry";

export default function SkillsPage() {
  const skills = listSkills();
  return (
    <div className="page-enter space-y-3">
      <div>
        <div className="terminal-label">Skill Registry</div>
        <h1 className="mt-1 text-3xl font-black tracking-[0.12em]">SKILLS</h1>
      </div>
      <div className="grid gap-2 lg:grid-cols-2 xl:grid-cols-3">
        {skills.map((skill) => (
          <Card key={skill.id} className="card-lift stagger-item">
            <CardHeader>
              <CardTitle>{skill.name}</CardTitle>
              <Badge tone={skill.enabled ? "green" : "gray"}>{skill.enabled ? "enabled" : "disabled"}</Badge>
            </CardHeader>
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge tone="orange">{skill.category}</Badge>
              <Badge>{skill.riskLevel}</Badge>
              <Badge>{skill.executionMode}</Badge>
              {skill.requiredIntegrations.map((integration) => <Badge key={integration}>{integration}</Badge>)}
            </div>
            <div className="mt-1.5 text-[0.7rem] leading-5 text-[#a8a29a]">{skill.description}</div>
            {skill.template ? (
              <details className="mt-1.5 text-[0.66rem] text-[#6f6a61]">
                <summary className="cursor-pointer text-[0.55rem] uppercase tracking-[0.14em] text-[#6f6a61] hover:text-[#e86f3a]">
                  Template prompt
                </summary>
                <div className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap border border-[#2a302c] bg-[#080a09] p-2 leading-5">
                  {skill.template}
                </div>
              </details>
            ) : null}
          </Card>
        ))}
      </div>
    </div>
  );
}
