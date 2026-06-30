import { Priority, TicketStatus, type Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { enqueueRouteTicket } from "@/lib/queue";
import { computeDueDates } from "@/lib/sla";
import { logger } from "@/lib/logger";
import { canTransition } from "@/lib/ticket-status";
import type { RoutingResult } from "@/lib/routing";

export { canTransition } from "@/lib/ticket-status";

const log = logger.child({ module: "tickets" });

/** Creates a ticket and enqueues async LLM routing. */
export async function createTicket(input: {
  requesterId: string;
  title: string;
  description: string;
  priority?: Priority;
}) {
  const ticket = await prisma.ticket.create({
    data: {
      title: input.title,
      description: input.description,
      requesterId: input.requesterId,
      priority: input.priority ?? Priority.MEDIUM,
      status: TicketStatus.NEW,
    },
  });

  await writeAudit({
    actorId: input.requesterId,
    action: "ticket.created",
    entity: "Ticket",
    entityId: ticket.id,
  });

  // Fire-and-forget enqueue; if the queue is down the ticket still exists and
  // can be triaged manually.
  try {
    await enqueueRouteTicket({ ticketId: ticket.id });
  } catch (err) {
    log.error({ err, ticketId: ticket.id }, "Failed to enqueue routing job");
  }

  return ticket;
}

/**
 * Applies an LLM routing decision to a ticket: sets category/priority/team,
 * computes SLA deadlines, and — when confident — auto-assigns to the least
 * loaded agent on the target team. Persists a RoutingDecision row either way.
 */
export async function applyRouting(
  ticketId: string,
  decision: RoutingResult,
  confidenceThreshold: number,
  latencyMs = 0,
) {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) throw new Error(`Ticket ${ticketId} not found`);

  // Resolve target team: provider suggestion → category default.
  let teamId = decision.suggestedTeamId;
  let slaWindow: { slaResponseMins: number; slaResolutionMins: number } | null = null;
  if (decision.suggestedCategoryId) {
    const category = await prisma.category.findUnique({
      where: { id: decision.suggestedCategoryId },
    });
    if (category) {
      teamId = teamId ?? category.defaultTeamId;
      slaWindow = {
        slaResponseMins: category.slaResponseMins,
        slaResolutionMins: category.slaResolutionMins,
      };
    }
  }

  const now = new Date();
  const due = slaWindow ? computeDueDates(now, slaWindow, decision.suggestedPriority) : null;

  // Auto-assign if confident and we have a team to draw from.
  const confident = decision.confidence >= confidenceThreshold;
  let assigneeId: string | null = null;
  if (confident && teamId) {
    assigneeId = await pickLeastLoadedAgent(teamId);
  }

  const status = assigneeId
    ? TicketStatus.ASSIGNED
    : TicketStatus.TRIAGED;

  await prisma.$transaction([
    prisma.ticket.update({
      where: { id: ticketId },
      data: {
        categoryId: decision.suggestedCategoryId ?? ticket.categoryId,
        priority: decision.suggestedPriority,
        teamId: teamId ?? ticket.teamId,
        assigneeId: assigneeId ?? ticket.assigneeId,
        status,
        autoRouted: confident,
        responseDueAt: due?.responseDueAt ?? ticket.responseDueAt,
        resolutionDueAt: due?.resolutionDueAt ?? ticket.resolutionDueAt,
      },
    }),
    prisma.routingDecision.create({
      data: {
        ticketId,
        provider: decision.provider,
        model: decision.model,
        suggestedCategoryId: decision.suggestedCategoryId,
        suggestedPriority: decision.suggestedPriority,
        suggestedTeamId: teamId,
        confidence: decision.confidence,
        rationale: decision.rationale,
        applied: confident,
        latencyMs,
        tokensUsed: decision.tokensUsed,
      },
    }),
  ]);

  await writeAudit({
    action: "ticket.routed",
    entity: "Ticket",
    entityId: ticketId,
    diff: {
      provider: decision.provider,
      confidence: decision.confidence,
      autoAssigned: !!assigneeId,
      status,
    },
  });

  return { status, assigneeId, autoRouted: confident };
}

/** Returns the id of the team agent with the fewest open assigned tickets. */
async function pickLeastLoadedAgent(teamId: string): Promise<string | null> {
  const agents = await prisma.user.findMany({
    where: { teamId, role: { in: ["AGENT", "MANAGER"] } },
    select: {
      id: true,
      _count: {
        select: {
          assignedTickets: {
            where: { status: { notIn: [TicketStatus.RESOLVED, TicketStatus.CLOSED] } },
          },
        },
      },
    },
  });
  if (agents.length === 0) return null;
  agents.sort((a, b) => a._count.assignedTickets - b._count.assignedTickets);
  return agents[0].id;
}

/** Transitions a ticket's status, stamping first-response / resolved markers. */
export async function updateTicketStatus(
  actor: { id: string; role: Role },
  ticketId: string,
  to: TicketStatus,
) {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) throw new Error("Ticket not found");
  if (!canTransition(ticket.status, to)) {
    throw new Error(`Invalid transition ${ticket.status} → ${to}`);
  }

  const now = new Date();
  const updated = await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      status: to,
      firstResponseAt:
        ticket.firstResponseAt ??
        (to === TicketStatus.IN_PROGRESS || to === TicketStatus.ASSIGNED ? now : undefined),
      resolvedAt: to === TicketStatus.RESOLVED ? now : ticket.resolvedAt,
    },
  });

  await writeAudit({
    actorId: actor.id,
    action: "ticket.status_changed",
    entity: "Ticket",
    entityId: ticketId,
    diff: { from: ticket.status, to },
  });

  return updated;
}

/** Manually (re)assigns a ticket to an agent. */
export async function assignTicket(
  actor: { id: string; role: Role },
  ticketId: string,
  assigneeId: string,
) {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) throw new Error("Ticket not found");

  const updated = await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      assigneeId,
      status: ticket.status === TicketStatus.NEW || ticket.status === TicketStatus.TRIAGED
        ? TicketStatus.ASSIGNED
        : ticket.status,
    },
  });

  await writeAudit({
    actorId: actor.id,
    action: "ticket.assigned",
    entity: "Ticket",
    entityId: ticketId,
    diff: { from: ticket.assigneeId, to: assigneeId },
  });

  return updated;
}

/** Adds a comment; stamps first-response time when an agent first replies. */
export async function addComment(
  actor: { id: string; role: Role },
  ticketId: string,
  body: string,
) {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) throw new Error("Ticket not found");

  const isAgentReply = actor.id !== ticket.requesterId;
  const [comment] = await prisma.$transaction([
    prisma.comment.create({
      data: { ticketId, authorId: actor.id, body },
    }),
    prisma.ticket.update({
      where: { id: ticketId },
      data: {
        firstResponseAt:
          !ticket.firstResponseAt && isAgentReply ? new Date() : ticket.firstResponseAt,
      },
    }),
  ]);

  await writeAudit({
    actorId: actor.id,
    action: "ticket.commented",
    entity: "Ticket",
    entityId: ticketId,
  });

  return comment;
}
