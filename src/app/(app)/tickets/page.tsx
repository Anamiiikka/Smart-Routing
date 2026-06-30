import Link from "next/link";
import { requireUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { Badge } from "@/components/ui";
import { PRIORITY_STYLES, STATUS_STYLES, relativeTime } from "@/lib/ui-format";

export const dynamic = "force-dynamic";

export default async function TicketsPage() {
  const user = await requireUser();
  const readAll = can(user.role, "ticket.readAll");

  const tickets = await prisma.ticket.findMany({
    where: readAll ? {} : { requesterId: user.id },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    include: {
      category: { select: { name: true } },
      assignee: { select: { name: true } },
      requester: { select: { name: true } },
    },
  });

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">{readAll ? "All tickets" : "My tickets"}</h1>
        {can(user.role, "ticket.create") && (
          <Link
            href="/tickets/new"
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
          >
            New ticket
          </Link>
        )}
      </div>

      {tickets.length === 0 ? (
        <p className="text-sm text-muted-foreground">No tickets yet.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">Title</th>
                <th className="px-3 py-2">Priority</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">Assignee</th>
                <th className="px-3 py-2">SLA</th>
                <th className="px-3 py-2">Created</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-3 py-2 text-muted-foreground">{t.number}</td>
                  <td className="px-3 py-2">
                    <Link href={`/tickets/${t.id}`} className="font-medium hover:underline">
                      {t.title}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <Badge className={PRIORITY_STYLES[t.priority]}>{t.priority}</Badge>
                  </td>
                  <td className="px-3 py-2">
                    <Badge className={STATUS_STYLES[t.status]}>{t.status}</Badge>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{t.category?.name ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{t.assignee?.name ?? "—"}</td>
                  <td className="px-3 py-2">
                    {t.responseBreached || t.resolutionBreached ? (
                      <Badge className="border-red-500/30 bg-red-500/15 text-red-500">Breached</Badge>
                    ) : (
                      <span className="text-muted-foreground">OK</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{relativeTime(t.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
