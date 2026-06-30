import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, handleApiError, requireApiUser } from "@/lib/api";
import { canCommentOnTicket } from "@/lib/rbac";
import { addComment } from "@/lib/tickets";
import { createCommentSchema } from "@/lib/validation";

// POST /api/tickets/:id/comments — add a comment (ownership-aware).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser();
    const { id } = await params;
    const body = createCommentSchema.parse(await req.json());

    const ticket = await prisma.ticket.findUnique({
      where: { id },
      select: { requesterId: true, assigneeId: true },
    });
    if (!ticket) throw new ApiError(404, "Ticket not found");
    if (!canCommentOnTicket(user, ticket)) throw new ApiError(403, "Forbidden");

    const comment = await addComment(user, id, body.body);
    return NextResponse.json({ comment }, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}
