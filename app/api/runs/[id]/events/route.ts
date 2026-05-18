import { getRun } from "@/lib/db/repositories";
import { getRunBuffer, subscribeToRun, type RunEvent } from "@/lib/agent/event-bus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const run = await getRun(id);
  if (!run) return new Response("Not found", { status: 404 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      let pendingCloseTimer: ReturnType<typeof setTimeout> | null = null;
      let heartbeat: ReturnType<typeof setInterval> | null = null;

      const send = (event: RunEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event.type}\n`));
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {}
        // Close shortly after a terminal event, giving the client a moment to
        // process trailing output. No DB polling needed — terminal status is
        // delivered via the event bus.
        if (event.type === "run.completed" || event.type === "run.failed") {
          if (!pendingCloseTimer) pendingCloseTimer = setTimeout(cleanup, 1_500);
        }
      };

      const cleanup = () => {
        if (closed) return;
        closed = true;
        if (heartbeat) clearInterval(heartbeat);
        if (pendingCloseTimer) clearTimeout(pendingCloseTimer);
        unsubscribe();
        try {
          controller.close();
        } catch {}
      };

      // Backfill — if a terminal event is already in the buffer the cleanup
      // path triggers immediately, so we never leak a stream.
      for (const event of getRunBuffer(id)) send(event);

      const unsubscribe = subscribeToRun(id, send);

      // Single 15s keep-alive ping — replaces the old 5s setInterval that
      // hit `getRun` (DB read) every cycle for every open run tab.
      heartbeat = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`: heartbeat ${Date.now()}\n\n`));
        } catch {}
      }, 15_000);

      request.signal.addEventListener("abort", cleanup);
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
