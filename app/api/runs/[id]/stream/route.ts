import { getRun } from "@/lib/db/repositories";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      let lastStatus = "";
      let lastStepCount = 0;
      let attempts = 0;
      const maxAttempts = 600;

      const tick = async () => {
        attempts++;
        const run = await getRun(id);
        if (!run) {
          send("error", { message: "Run not found" });
          controller.close();
          return;
        }

        if (run.status !== lastStatus) {
          send("status", { status: run.status });
          lastStatus = run.status;
        }

        if (run.steps.length > lastStepCount) {
          for (let i = lastStepCount; i < run.steps.length; i++) {
            send("step", run.steps[i]);
          }
          lastStepCount = run.steps.length;
        }

        if (["completed", "failed", "cancelled"].includes(run.status)) {
          send("final", {
            output: run.finalOutput,
            cost: run.costEstimate,
            tokens: run.tokensEstimate,
            artifacts: run.createdArtifacts,
          });
          controller.close();
          return;
        }

        if (attempts >= maxAttempts) {
          send("timeout", { message: "Stream timed out" });
          controller.close();
          return;
        }

        setTimeout(tick, 500);
      };

      tick().catch((error) => {
        send("error", { message: error instanceof Error ? error.message : "Stream error" });
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
