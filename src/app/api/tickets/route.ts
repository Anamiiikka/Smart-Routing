import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireApiAction, requireApiUser, handleApiError } from "@/lib/api";
import { can } from "@/lib/rbac";
import { createTicket } from "@/lib/tickets";
import { createTicketSchema, listTicketsQuerySchema } from "@/lib/validation";

// GET /api/tickets — list tickets, scoped by role.
export async function GET(req: Request) {
  try {
    const user = await requireApiUser();
    const { searchParams } = new URL(req.url);
    const query = listTicketsQuerySchema.parse(Object.fromEntries(searchParams));

    const where: Prisma.TicketWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.priority) where.priority = query.priority;

    // REQUESTERs only ever see their own tickets. Others can opt into "mine".
    if (!can(user.role, "ticket.readAll")) {
      where.requesterId = user.id;
    } else if (query.mine) {
      where.assigneeId = user.id;
    }

    const tickets = await prisma.ticket.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      include: {
        category: { select: { name: true } },
        team: { select: { name: true } },
        assignee: { select: { name: true } },
        requester: { select: { name: true } },
      },
    });

    return NextResponse.json({ tickets });
  } catch (e) {
    return handleApiError(e);
  }
}

// POST /api/tickets — create a ticket (any authenticated user with create cap).
export async function POST(req: Request) {
  try {
    const user = await requireApiAction("ticket.create");
    const body = createTicketSchema.parse(await req.json());

    const ticket = await createTicket({
      requesterId: user.id,
      title: body.title,
      description: body.description,
      priority: body.priority,
    });

    return NextResponse.json({ ticket }, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}
