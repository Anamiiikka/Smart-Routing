import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { processRouteTicket } from "@/worker/route-ticket";

// Routes the oldest un-triaged ticket and prints the outcome. Verifies the
// full pipeline: provider -> applyRouting -> SLA -> auto-assign.
async function main() {
  const ticket = await prisma.ticket.findFirst({
    where: { status: "NEW" },
    orderBy: { createdAt: "asc" },
  });
  if (!ticket) {
    console.log("No NEW tickets to route. Re-run `npm run db:seed`.");
    return;
  }

  console.log(`Routing ticket #${ticket.number}: "${ticket.title}"`);
  console.log(`Provider: ${process.env.LLM_PROVIDER}`);
  const start = Date.now();
  await processRouteTicket(ticket.id);
  console.log(`Done in ${Date.now() - start}ms`);

  const after = await prisma.ticket.findUnique({
    where: { id: ticket.id },
    include: {
      category: { select: { name: true } },
      team: { select: { name: true } },
      assignee: { select: { name: true } },
      routingDecisions: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  const d = after?.routingDecisions[0];
  console.log({
    status: after?.status,
    priority: after?.priority,
    category: after?.category?.name,
    team: after?.team?.name,
    assignee: after?.assignee?.name ?? "(unassigned)",
    autoRouted: after?.autoRouted,
    confidence: d?.confidence,
    latencyMs: d?.latencyMs,
    responseDueAt: after?.responseDueAt,
    rationale: d?.rationale,
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
