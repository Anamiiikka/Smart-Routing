import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiAction, handleApiError } from "@/lib/api";

// GET /api/agents — assignable users (agents + managers), for the assign UI.
export async function GET() {
  try {
    await requireApiAction("ticket.assign");
    const agents = await prisma.user.findMany({
      where: { role: { in: ["AGENT", "MANAGER"] } },
      select: { id: true, name: true, role: true, team: { select: { name: true } } },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ agents });
  } catch (e) {
    return handleApiError(e);
  }
}
