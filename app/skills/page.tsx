import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { listSkills } from "@/lib/skills/registry";

export default function SkillsPage() {
  const skills = listSkills();
  return (
    <div className="space-y-4">
      <div>
        <div className="terminal-label">Skill Registry</div>
        <h1 className="mt-2 text-3xl font-black tracking-[0.12em]">SKILLS</h1>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {skills.map((skill) => (
          <Card key={skill.id}>
            <CardHeader>
              <CardTitle>{skill.name}</CardTitle>
              <Badge tone={skill.enabled ? "green" : "gray"}>{skill.enabled ? "enabled" : "disabled"}</Badge>
            </CardHeader>
            <div className="text-sm leading-6 text-[#a8a29a]">{skill.description}</div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge tone="orange">{skill.category}</Badge>
              <Badge>{skill.riskLevel}</Badge>
              <Badge>{skill.executionMode}</Badge>
              {skill.requiredIntegrations.map((integration) => <Badge key={integration}>{integration}</Badge>)}
            </div>
            <div className="mt-3 border border-[#2a302c] bg-[#080a09] p-3 text-xs leading-5 text-[#6f6a61]">{skill.template}</div>
          </Card>
        ))}
      </div>
    </div>
  );
}
