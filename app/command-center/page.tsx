import { AudiencePanel } from "@/components/command-center/audience-panel";
import { CommandBar } from "@/components/command-center/command-bar";
import { CommandCenterShell } from "@/components/command-center/cc-shell";
import { LatestUpload } from "@/components/command-center/latest-upload";
import { ResearchPanel } from "@/components/command-center/research-panel";
import { SchedulePanel } from "@/components/command-center/schedule-panel";
import { SocialTiles } from "@/components/command-center/social-tiles";
import { TaskPanel } from "@/components/command-center/task-panel";
import { TerminalPane } from "@/components/command-center/terminal-pane";
import { TokenBurn } from "@/components/command-center/token-burn";
import { WeeklyReview } from "@/components/command-center/weekly-review";
import { getCommandCenterData } from "@/lib/command-center/data";

export const dynamic = "force-dynamic";

export default async function CommandCenterPage() {
  const data = await getCommandCenterData();

  return (
    <div className="flex flex-col bg-[#0c0e0b]">
      <CommandCenterShell
        overview={
          <div className="space-y-3">
            <TokenBurn
              percent={data.tokenBurn.percent}
              used={data.tokenBurn.used}
              max={data.tokenBurn.max}
              projDelta={data.tokenBurn.projDelta}
              lastPullMinutes={data.tokenBurn.lastPullMinutes}
            />
            <SocialTiles tiles={data.socialTiles} />
            <LatestUpload
              title={data.latestUpload.title}
              views={data.latestUpload.views}
              likes={data.latestUpload.likes}
              comments={data.latestUpload.comments}
              age={data.latestUpload.age}
            />
            <CommandBar />
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <SchedulePanel slots={data.schedule} />
              <TaskPanel initialTasks={data.tasks} />
            </div>
            <WeeklyReview data={data.weeklyReview} />
            <TerminalPane />
          </div>
        }
        audience={<AudiencePanel />}
        research={
          <div className="space-y-3">
            <CommandBar />
            <ResearchPanel repos={data.repos} hnItems={data.hnItems} />
            <TerminalPane />
          </div>
        }
      />
    </div>
  );
}
