import { Priority } from "@prisma/client";

/**
 * Priority shrinks (or extends) the category's base SLA window. URGENT tickets
 * get a quarter of the time; LOW tickets get double.
 */
export const PRIORITY_SLA_MULTIPLIER: Record<Priority, number> = {
  URGENT: 0.25,
  HIGH: 0.5,
  MEDIUM: 1,
  LOW: 2,
};

/** Numeric ordering for sorting queues (higher = more urgent). */
export const PRIORITY_RANK: Record<Priority, number> = {
  URGENT: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

export interface SlaWindow {
  slaResponseMins: number;
  slaResolutionMins: number;
}

export interface DueDates {
  responseDueAt: Date;
  resolutionDueAt: Date;
}

/** Computes response/resolution deadlines from a category's SLA and priority. */
export function computeDueDates(
  from: Date,
  category: SlaWindow,
  priority: Priority,
): DueDates {
  const mult = PRIORITY_SLA_MULTIPLIER[priority];
  const responseMs = category.slaResponseMins * mult * 60_000;
  const resolutionMs = category.slaResolutionMins * mult * 60_000;
  return {
    responseDueAt: new Date(from.getTime() + responseMs),
    resolutionDueAt: new Date(from.getTime() + resolutionMs),
  };
}

/** Whether a deadline has passed relative to `now`, when not yet satisfied. */
export function isBreached(dueAt: Date | null, satisfiedAt: Date | null, now: Date): boolean {
  if (!dueAt) return false;
  if (satisfiedAt) return satisfiedAt > dueAt; // satisfied late = breached
  return now > dueAt;
}
