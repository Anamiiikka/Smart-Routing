import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { can, canViewTicket } from "@/lib/rbac";
import { Badge, Card } from "@/components/ui";
import { PRIORITY_STYLES, STATUS_STYLES, relativeTime } from "@/lib/ui-format";
import { TicketActions } from "@/components/ticket-actions";
import { CommentForm } from "@/components/comment-form";

export const dynamic = "force-dynamic";

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: {
      category: true,
      team: true,
      assignee: { select: { id: true, name: true } },
      requester: { select: { id: true, name: true } },
      comments: { orderBy: { createdAt: "asc" }, include: { author: { select: { name: true } } } },
      routingDecisions: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  if (!ticket) notFound();
  if (!canViewTicket(user, ticket)) notFound();

  const decision = ticket.routingDecisions[0];
  const canManage = can(user.role, "ticket.updateStatus");

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="flex flex-col gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">#{ticket.number}</span>
            <Badge className={PRIORITY_STYLES[ticket.priority]}>{ticket.priority}</Badge>
            <Badge className={STATUS_STYLES[ticket.status]}>{ticket.status}</Badge>
            {ticket.autoRouted && (
              <Badge className="border-green-500/30 bg-green-500/15 text-green-400">
                Auto-routed
              </Badge>
            )}
          </div>
          <h1 className="mt-2 text-xl font-semibold">{ticket.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Opened by {ticket.requester.name} {relativeTime(ticket.createdAt)}
          </p>
        </div>

        <Card>
          <p className="whitespace-pre-wrap text-sm">{ticket.description}</p>
        </Card>

        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase text-muted-foreground">
            Comments ({ticket.comments.length})
          </h2>
          <div className="flex flex-col gap-3">
            {ticket.comments.map((c) => (
              <Card key={c.id}>
                <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{c.author.name}</span>
                  <span>{relativeTime(c.createdAt)}</span>
                </div>
                <p className="whitespace-pre-wrap text-sm">{c.body}</p>
              </Card>
            ))}
            {ticket.comments.length === 0 && (
              <p className="text-sm text-muted-foreground">No comments yet.</p>
            )}
          </div>
          <div className="mt-3">
            <CommentForm ticketId={ticket.id} />
          </div>
        </section>
      </div>

      <aside className="flex flex-col gap-4">
        <Card>
          <h2 className="mb-2 text-sm font-semibold">Details</h2>
          <dl className="space-y-2 text-sm">
            <Row label="Category" value={ticket.category?.name ?? "Pending triage"} />
            <Row label="Team" value={ticket.team?.name ?? "—"} />
            <Row label="Assignee" value={ticket.assignee?.name ?? "Unassigned"} />
            <Row
              label="Response due"
              value={ticket.responseDueAt ? relativeTime(ticket.responseDueAt) : "—"}
              danger={ticket.responseBreached}
            />
            <Row
              label="Resolution due"
              value={ticket.resolutionDueAt ? relativeTime(ticket.resolutionDueAt) : "—"}
              danger={ticket.resolutionBreached}
            />
          </dl>
        </Card>

        {decision && (
          <Card>
            <h2 className="mb-2 text-sm font-semibold">AI routing</h2>
            <dl className="space-y-2 text-sm">
              <Row label="Provider" value={`${decision.provider} (${decision.model})`} />
              <Row label="Confidence" value={`${Math.round(decision.confidence * 100)}%`} />
              <Row label="Latency" value={`${decision.latencyMs} ms`} />
              {decision.error && <Row label="Error" value={decision.error} danger />}
            </dl>
            {decision.rationale && (
              <p className="mt-2 border-t border-border pt-2 text-xs text-muted-foreground">
                {decision.rationale}
              </p>
            )}
          </Card>
        )}

        {canManage && (
          <Card>
            <h2 className="mb-2 text-sm font-semibold">Actions</h2>
            <TicketActions
              ticketId={ticket.id}
              currentStatus={ticket.status}
              currentPriority={ticket.priority}
              canAssign={can(user.role, "ticket.assign")}
            />
          </Card>
        )}
      </aside>
    </div>
  );
}

function Row({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={`text-right ${danger ? "text-red-500" : ""}`}>{value}</dd>
    </div>
  );
}
