import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { createTicket } from "@/lib/tickets";

// Creates a ticket via the real service path (insert + enqueue to pg-boss).
// A separately-running worker should then pick it up and route it.
async function main() {
  const requester = await prisma.user.findUnique({
    where: { email: "requester@example.com" },
  });
  if (!requester) throw new Error("Seed the DB first (npm run db:seed).");

  const ticket = await createTicket({
    requesterId: requester.id,
    title: "Payment failed with card declined error at checkout",
    description:
      "My credit card keeps getting declined at checkout even though it has sufficient funds. " +
      "I urgently need to pay my outstanding invoice before the due date.",
  });

  console.log(`Created + enqueued ticket #${ticket.number} (${ticket.id}), status=${ticket.status}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
