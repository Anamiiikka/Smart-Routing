import { Priority, TicketStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const OPEN_STATUSES: TicketStatus[] = ["NEW", "TRIAGED", "ASSIGNED", "IN_PROGRESS"];

export interface DashboardMetrics {
  generatedAt: string;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  openTickets: number;
  breachedTickets: number;
  autoRoutedPct: number;
  avgResolutionMins: number | null;
  avgFirstResponseMins: number | null;
  health: {
    queueDepth: number;
    llmAvgLatencyMs: number | null;
    llmErrorRatePct: number | null;
    routedLastHour: number;
  };
}

/** Aggregates all numbers the dashboard needs in a single call. */
export async function getMetrics(): Promise<DashboardMetrics> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const [
    statusGroups,
    priorityGroups,
    openTickets,
    breachedTickets,
    totalTickets,
    autoRouted,
    resolved,
    recentDecisions,
    queueDepth,
  ] = await Promise.all([
    prisma.ticket.groupBy({ by: ["status"], _count: true }),
    prisma.ticket.groupBy({ by: ["priority"], _count: true }),
    prisma.ticket.count({ where: { status: { in: OPEN_STATUSES } } }),
    prisma.ticket.count({
      where: { OR: [{ responseBreached: true }, { resolutionBreached: true }] },
    }),
    prisma.ticket.count(),
    prisma.ticket.count({ where: { autoRouted: true } }),
    prisma.ticket.findMany({
      where: { resolvedAt: { not: null } },
      select: { createdAt: true, resolvedAt: true, firstResponseAt: true },
    }),
    prisma.routingDecision.findMany({
      where: { createdAt: { gte: oneHourAgo } },
      select: { latencyMs: true, error: true },
    }),
    getQueueDepth(),
  ]);

  const byStatus = Object.fromEntries(
    Object.values(TicketStatus).map((s) => [s, 0]),
  ) as Record<string, number>;
  for (const g of statusGroups) byStatus[g.status] = g._count;

  const byPriority = Object.fromEntries(
    Object.values(Priority).map((p) => [p, 0]),
  ) as Record<string, number>;
  for (const g of priorityGroups) byPriority[g.priority] = g._count;

  const avgResolutionMins = avg(
    resolved
      .filter((t) => t.resolvedAt)
      .map((t) => (t.resolvedAt!.getTime() - t.createdAt.getTime()) / 60000),
  );
  const avgFirstResponseMins = avg(
    resolved
      .filter((t) => t.firstResponseAt)
      .map((t) => (t.firstResponseAt!.getTime() - t.createdAt.getTime()) / 60000),
  );

  const llmAvgLatencyMs = avg(recentDecisions.map((d) => d.latencyMs));
  const llmErrorRatePct =
    recentDecisions.length === 0
      ? null
      : (recentDecisions.filter((d) => d.error).length / recentDecisions.length) * 100;

  return {
    generatedAt: new Date().toISOString(),
    byStatus,
    byPriority,
    openTickets,
    breachedTickets,
    autoRoutedPct: totalTickets === 0 ? 0 : (autoRouted / totalTickets) * 100,
    avgResolutionMins,
    avgFirstResponseMins,
    health: {
      queueDepth,
      llmAvgLatencyMs: llmAvgLatencyMs === null ? null : Math.round(llmAvgLatencyMs),
      llmErrorRatePct,
      routedLastHour: recentDecisions.length,
    },
  };
}

function avg(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

/** Pending+active job count from pg-boss. Returns 0 if the schema isn't ready. */
async function getQueueDepth(): Promise<number> {
  try {
    const rows = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
      `SELECT count(*)::bigint AS count FROM pgboss.job
       WHERE state IN ('created', 'active', 'retry')`,
    );
    return Number(rows[0]?.count ?? 0);
  } catch {
    return 0; // worker hasn't initialised the pgboss schema yet
  }
}
