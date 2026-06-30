import type { Role } from "@prisma/client";

/**
 * Capability-based RBAC. Each role maps to a set of allowed actions. Keep this
 * pure (no DB / Node deps) so it can run in middleware (edge) and on the server.
 */
export type Action =
  | "ticket.create"
  | "ticket.readAll" // view tickets you don't own
  | "ticket.assign"
  | "ticket.updateStatus"
  | "ticket.comment"
  | "ticket.delete"
  | "category.manage"
  | "user.manage"
  | "dashboard.view"
  | "dashboard.systemHealth";

const ALL_ACTIONS: Action[] = [
  "ticket.create",
  "ticket.readAll",
  "ticket.assign",
  "ticket.updateStatus",
  "ticket.comment",
  "ticket.delete",
  "category.manage",
  "user.manage",
  "dashboard.view",
  "dashboard.systemHealth",
];

const MATRIX: Record<Role, Action[]> = {
  ADMIN: ALL_ACTIONS,
  MANAGER: [
    "ticket.create",
    "ticket.readAll",
    "ticket.assign",
    "ticket.updateStatus",
    "ticket.comment",
    "category.manage",
    "dashboard.view",
    "dashboard.systemHealth",
  ],
  AGENT: [
    "ticket.create",
    "ticket.readAll",
    "ticket.updateStatus",
    "ticket.comment",
    "dashboard.view",
  ],
  REQUESTER: ["ticket.create", "ticket.comment"],
};

export function can(role: Role, action: Action): boolean {
  return MATRIX[role].includes(action);
}

/** Whether a user may view a specific ticket (ownership-aware). */
export function canViewTicket(
  user: { id: string; role: Role },
  ticket: { requesterId: string; assigneeId: string | null },
): boolean {
  if (can(user.role, "ticket.readAll")) return true;
  return ticket.requesterId === user.id || ticket.assigneeId === user.id;
}

/** Whether a user may comment on a specific ticket. */
export function canCommentOnTicket(
  user: { id: string; role: Role },
  ticket: { requesterId: string; assigneeId: string | null },
): boolean {
  return can(user.role, "ticket.comment") && canViewTicket(user, ticket);
}
