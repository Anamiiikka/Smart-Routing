"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Priority, TicketStatus } from "@prisma/client";

const STATUSES: TicketStatus[] = [
  "NEW",
  "TRIAGED",
  "ASSIGNED",
  "IN_PROGRESS",
  "RESOLVED",
  "CLOSED",
];
const PRIORITIES: Priority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];

interface Agent {
  id: string;
  name: string;
  role: string;
  team: { name: string } | null;
}

export function TicketActions({
  ticketId,
  currentStatus,
  currentPriority,
  canAssign,
}: {
  ticketId: string;
  currentStatus: TicketStatus;
  currentPriority: Priority;
  canAssign: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);

  useEffect(() => {
    if (!canAssign) return;
    fetch("/api/agents")
      .then((r) => (r.ok ? r.json() : { agents: [] }))
      .then((d) => setAgents(d.agents ?? []))
      .catch(() => setAgents([]));
  }, [canAssign]);

  async function patch(payload: Record<string, unknown>) {
    setBusy(true);
    const res = await fetch(`/api/tickets/${ticketId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setBusy(false);
    if (res.ok) router.refresh();
  }

  return (
    <div className="flex flex-col gap-3 text-sm">
      <label className="flex flex-col gap-1">
        <span className="text-muted-foreground">Status</span>
        <select
          defaultValue={currentStatus}
          disabled={busy}
          onChange={(e) => patch({ status: e.target.value })}
          className="rounded-md border border-border bg-background px-2 py-1.5"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-muted-foreground">Priority</span>
        <select
          defaultValue={currentPriority}
          disabled={busy}
          onChange={(e) => patch({ priority: e.target.value })}
          className="rounded-md border border-border bg-background px-2 py-1.5"
        >
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </label>

      {canAssign && (
        <label className="flex flex-col gap-1">
          <span className="text-muted-foreground">Assign to</span>
          <select
            defaultValue=""
            disabled={busy || agents.length === 0}
            onChange={(e) => e.target.value && patch({ assigneeId: e.target.value })}
            className="rounded-md border border-border bg-background px-2 py-1.5"
          >
            <option value="">Select agent…</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} {a.team ? `· ${a.team.name}` : ""}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}
