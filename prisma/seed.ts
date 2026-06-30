import { PrismaClient, Priority, TicketStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Shared demo password for every seeded account.
const DEMO_PASSWORD = "Password123!";

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  // ---- Teams ----
  const teams = await Promise.all(
    ["Platform", "Billing", "Customer Support", "Security"].map((name) =>
      prisma.team.upsert({ where: { name }, update: {}, create: { name } }),
    ),
  );
  const teamByName = Object.fromEntries(teams.map((t) => [t.name, t]));

  // ---- Categories (with SLA windows in minutes) ----
  const categorySeed = [
    { name: "Bug", slaResponseMins: 60, slaResolutionMins: 480, team: "Platform" },
    { name: "Billing", slaResponseMins: 120, slaResolutionMins: 1440, team: "Billing" },
    { name: "Account Access", slaResponseMins: 30, slaResolutionMins: 240, team: "Security" },
    { name: "How-to / Question", slaResponseMins: 240, slaResolutionMins: 2880, team: "Customer Support" },
    { name: "Feature Request", slaResponseMins: 480, slaResolutionMins: 10080, team: "Platform" },
  ];
  const categories = await Promise.all(
    categorySeed.map((c) =>
      prisma.category.upsert({
        where: { name: c.name },
        update: {
          slaResponseMins: c.slaResponseMins,
          slaResolutionMins: c.slaResolutionMins,
          defaultTeamId: teamByName[c.team].id,
        },
        create: {
          name: c.name,
          slaResponseMins: c.slaResponseMins,
          slaResolutionMins: c.slaResolutionMins,
          defaultTeamId: teamByName[c.team].id,
        },
      }),
    ),
  );
  const categoryByName = Object.fromEntries(categories.map((c) => [c.name, c]));

  // ---- Users (one per role) ----
  const userSeed = [
    { email: "admin@example.com", name: "Avery Admin", role: "ADMIN" as const, team: undefined },
    { email: "manager@example.com", name: "Morgan Manager", role: "MANAGER" as const, team: "Platform" },
    { email: "agent1@example.com", name: "Alex Agent", role: "AGENT" as const, team: "Platform" },
    { email: "agent2@example.com", name: "Billie Agent", role: "AGENT" as const, team: "Billing" },
    { email: "requester@example.com", name: "Riley Requester", role: "REQUESTER" as const, team: undefined },
  ];
  const users = await Promise.all(
    userSeed.map((u) =>
      prisma.user.upsert({
        where: { email: u.email },
        update: { name: u.name, role: u.role, teamId: u.team ? teamByName[u.team].id : null },
        create: {
          email: u.email,
          name: u.name,
          role: u.role,
          passwordHash,
          teamId: u.team ? teamByName[u.team].id : null,
        },
      }),
    ),
  );
  const userByEmail = Object.fromEntries(users.map((u) => [u.email, u]));
  const requester = userByEmail["requester@example.com"];
  const agent1 = userByEmail["agent1@example.com"];

  // ---- Demo tickets ----
  // Only seed if there are no tickets yet, so re-running doesn't duplicate.
  const existing = await prisma.ticket.count();
  if (existing === 0) {
    const ticketSeed = [
      {
        title: "Login page returns 500 after password reset",
        description:
          "After resetting my password via the email link, attempting to log in throws a 500 error. Cleared cache, still failing on Chrome and Firefox.",
        status: TicketStatus.NEW,
        priority: Priority.HIGH,
        category: "Bug",
      },
      {
        title: "Double charged on my June invoice",
        description:
          "I was charged twice for the Pro plan on June 3rd. Need one charge refunded. Invoice numbers INV-8841 and INV-8842.",
        status: TicketStatus.TRIAGED,
        priority: Priority.URGENT,
        category: "Billing",
      },
      {
        title: "How do I export my data to CSV?",
        description: "Looking for a way to bulk-export all my tickets to a spreadsheet.",
        status: TicketStatus.ASSIGNED,
        priority: Priority.LOW,
        category: "How-to / Question",
      },
      {
        title: "Locked out of admin account",
        description:
          "MFA device was lost and I can no longer access the org admin account. Need to regain access urgently.",
        status: TicketStatus.IN_PROGRESS,
        priority: Priority.URGENT,
        category: "Account Access",
      },
      {
        title: "Add dark mode to the dashboard",
        description: "Would love a dark theme for late-night triage sessions.",
        status: TicketStatus.NEW,
        priority: Priority.LOW,
        category: "Feature Request",
      },
    ];

    for (const t of ticketSeed) {
      const cat = categoryByName[t.category];
      await prisma.ticket.create({
        data: {
          title: t.title,
          description: t.description,
          status: t.status,
          priority: t.priority,
          categoryId: cat.id,
          teamId: cat.defaultTeamId,
          requesterId: requester.id,
          assigneeId:
            t.status === TicketStatus.ASSIGNED || t.status === TicketStatus.IN_PROGRESS
              ? agent1.id
              : null,
        },
      });
    }
  }

  console.log("Seed complete.");
  console.log(`Demo login password for all accounts: ${DEMO_PASSWORD}`);
  console.log("Accounts:", userSeed.map((u) => `${u.email} (${u.role})`).join(", "));
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
