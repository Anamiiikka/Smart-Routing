import { TicketStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

const log = logger.child({ module: "sla-sweep" });
const CLOSED_STATES: TicketStatus[] = [TicketStatus.RESOLVED, TicketStatus.CLOSED];

/**
 * Flags tickets that have blown their response or resolution SLA. Idempotent:
 * only flips the breach flag from false → true, so it's safe to run on a cron.
 */
export async function runSlaSweep(now = new Date()) {
  const [response, resolution] = await prisma.$transaction([
    prisma.ticket.updateMany({
      where: {
        responseBreached: false,
        firstResponseAt: null,
        responseDueAt: { lt: now },
        status: { notIn: CLOSED_STATES },
      },
      data: { responseBreached: true },
    }),
    prisma.ticket.updateMany({
      where: {
        resolutionBreached: false,
        resolvedAt: null,
        resolutionDueAt: { lt: now },
        status: { notIn: CLOSED_STATES },
      },
      data: { resolutionBreached: true },
    }),
  ]);

  if (response.count || resolution.count) {
    log.warn(
      { responseBreaches: response.count, resolutionBreaches: resolution.count },
      "SLA breaches flagged",
    );
  }
  return { responseBreaches: response.count, resolutionBreaches: resolution.count };
}
