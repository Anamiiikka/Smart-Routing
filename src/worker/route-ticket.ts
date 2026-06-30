import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { getRoutingProvider } from "@/lib/routing";
import { applyRouting } from "@/lib/tickets";

const log = logger.child({ module: "route-ticket" });

/** Processes one routing job: classify the ticket and apply the decision. */
export async function processRouteTicket(ticketId: string): Promise<void> {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) {
    log.warn({ ticketId }, "Ticket no longer exists; skipping");
    return;
  }

  const [categories, teams] = await Promise.all([
    prisma.category.findMany({ select: { id: true, name: true } }),
    prisma.team.findMany({ select: { id: true, name: true } }),
  ]);

  const provider = getRoutingProvider();
  const start = Date.now();
  try {
    const result = await provider.route({
      title: ticket.title,
      description: ticket.description,
      categories,
      teams,
    });
    const latencyMs = Date.now() - start;
    const outcome = await applyRouting(
      ticketId,
      result,
      env.ROUTING_CONFIDENCE_THRESHOLD,
      latencyMs,
    );
    log.info({ ticketId, latencyMs, ...outcome }, "Ticket routed");
  } catch (err) {
    // Record the failed attempt so error rate surfaces on the dashboard,
    // then rethrow so pg-boss retries with backoff.
    await prisma.routingDecision.create({
      data: {
        ticketId,
        provider: env.LLM_PROVIDER,
        model: env.OPENAI_MODEL,
        confidence: 0,
        rationale: "",
        applied: false,
        latencyMs: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
      },
    });
    log.error({ err, ticketId }, "Routing failed");
    throw err;
  }
}
