import { requireApiAction, handleApiError } from "@/lib/api";
import { getMetrics } from "@/lib/metrics";

export const dynamic = "force-dynamic";

const INTERVAL_MS = 5000;

// GET /api/stream/metrics — Server-Sent Events feed of dashboard metrics.
export async function GET(req: Request) {
  try {
    await requireApiAction("dashboard.view");
  } catch (e) {
    return handleApiError(e);
  }

  const encoder = new TextEncoder();
  let timer: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream({
    async start(controller) {
      const send = async () => {
        try {
          const metrics = await getMetrics();
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(metrics)}\n\n`));
        } catch {
          // Skip a tick on transient errors; keep the connection open.
        }
      };

      await send(); // initial payload
      timer = setInterval(send, INTERVAL_MS);

      // Clean up when the client disconnects.
      req.signal.addEventListener("abort", () => {
        if (timer) clearInterval(timer);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
    cancel() {
      if (timer) clearInterval(timer);
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
