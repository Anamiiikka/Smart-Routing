import { TicketStatus } from "@prisma/client";

/**
 * Allowed status transitions. Kept in its own dependency-free module so the
 * lifecycle rules can be unit-tested without importing the DB/queue layer.
 */
export const TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  NEW: ["TRIAGED", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "CLOSED"],
  TRIAGED: ["ASSIGNED", "IN_PROGRESS", "RESOLVED", "CLOSED"],
  ASSIGNED: ["IN_PROGRESS", "RESOLVED", "CLOSED"],
  IN_PROGRESS: ["RESOLVED", "CLOSED"],
  RESOLVED: ["CLOSED", "IN_PROGRESS"],
  CLOSED: ["IN_PROGRESS"],
};

export function canTransition(from: TicketStatus, to: TicketStatus): boolean {
  return from === to || TRANSITIONS[from]?.includes(to);
}
