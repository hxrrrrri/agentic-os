import { getSession, getSessionHistory, subscribeSession } from "@/lib/terminal/manager";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;
  const session = getSession(sessionId);
  if (!session) return new Response("Session not found", { status: 404 });

  const encoder = new TextEncoder();
  let cleanup: (() => void) | undefined;

  const stream = new ReadableStream({
    start(controller) {
      function send(event: string, data: unknown) {
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          );
        } catch {
          // client disconnected mid-write
        }
      }

      send("history", {
        chunks: getSessionHistory(sessionId).map((chunk) => Buffer.from(chunk, "utf8").toString("base64")),
      });

      if (!session.alive) {
        send("exit", { code: 0 });
        try {
          controller.close();
        } catch {}
        return;
      }

      cleanup = subscribeSession(
        sessionId,
        // Base64-encode raw bytes so ANSI escape sequences survive JSON transport
        (chunk) => send("output", { chunk: Buffer.from(chunk, "utf8").toString("base64") }),
        (code) => {
          send("exit", { code });
          try {
            controller.close();
          } catch {}
          cleanup?.();
        },
        { replayHistory: false },
      );
    },
    cancel() {
      cleanup?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
