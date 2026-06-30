import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, handleApiError, requireApiUser } from "@/lib/api";
import { can, canViewTicket } from "@/lib/rbac";
import { assignTicket, updateTicketStatus } from "@/lib/tickets";
import { updateTicketSchema } from "@/lib/validation";

// GET /api/tickets/:id — ticket detail (ownership-aware).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser();
    const { id } = await params;

    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: {
        category: true,
        team: true,
        assignee: { select: { id: true, name: true } },
        requester: { select: { id: true, name: true } },
        comments: {
          orderBy: { createdAt: "asc" },
          include: { author: { select: { name: true } } },
        },
        routingDecisions: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });

    if (!ticket) throw new ApiError(404, "Ticket not found");
    if (!canViewTicket(user, ticket)) throw new ApiError(403, "Forbidden");

    return NextResponse.json({ ticket });
  } catch (e) {
    return handleApiError(e);
  }
}

// PATCH /api/tickets/:id — update status / assignee / priority (staff only).
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser();
    const { id } = await params;
    const body = updateTicketSchema.parse(await req.json());

    if (body.status) {
      if (!can(user.role, "ticket.updateStatus")) throw new ApiError(403, "Forbidden");
      await updateTicketStatus(user, id, body.status);
    }
    if (body.assigneeId) {
      if (!can(user.role, "ticket.assign")) throw new ApiError(403, "Forbidden");
      await assignTicket(user, id, body.assigneeId);
    }
    if (body.priority) {
      if (!can(user.role, "ticket.updateStatus")) throw new ApiError(403, "Forbidden");
      await prisma.ticket.update({ where: { id }, data: { priority: body.priority } });
    }

    const ticket = await prisma.ticket.findUnique({ where: { id } });
    return NextResponse.json({ ticket });
  } catch (e) {
    return handleApiError(e);
  }
}
