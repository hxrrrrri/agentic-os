import { ActivityFeed } from "@/components/command-center/activity-feed";
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
    <div className="cc-shell flex min-h-full flex-col">
      <CommandCenterShell
        overview={
          <div className="space-y-[10px]">
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
            <div className="grid grid-cols-1 gap-[10px] md:grid-cols-2">
              <SchedulePanel slots={data.schedule} />
              <TaskPanel initialTasks={data.tasks} />
            </div>
            <div className="cc-terminal-dock">
              <TerminalPane />
            </div>
          </div>
        }
        audience={
          <div className="space-y-[10px]">
            <SocialTiles tiles={data.socialTiles} />
            <LatestUpload
              title={data.latestUpload.title}
              views={data.latestUpload.views}
              likes={data.latestUpload.likes}
              comments={data.latestUpload.comments}
              age={data.latestUpload.age}
            />
            <CommandBar />
            <WeeklyReview data={data.weeklyReview} />
            <div className="cc-terminal-dock">
              <TerminalPane />
            </div>
          </div>
        }
        research={
          <div className="space-y-[10px]">
            <CommandBar />
            <ResearchPanel repos={data.repos} hnItems={data.hnItems} />
            <ActivityFeed items={data.activity} />
            <div className="cc-terminal-dock">
              <TerminalPane />
            </div>
          </div>
        }
      />
    </div>
  );
}
