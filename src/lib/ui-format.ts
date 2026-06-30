import type { Priority, TicketStatus } from "@prisma/client";

export const PRIORITY_STYLES: Record<Priority, string> = {
  URGENT: "bg-red-500/15 text-red-500 border-red-500/30",
  HIGH: "bg-orange-500/15 text-orange-500 border-orange-500/30",
  MEDIUM: "bg-blue-500/15 text-blue-500 border-blue-500/30",
  LOW: "bg-gray-500/15 text-gray-400 border-gray-500/30",
};

export const STATUS_STYLES: Record<TicketStatus, string> = {
  NEW: "bg-slate-500/15 text-slate-400 border-slate-500/30",
  TRIAGED: "bg-violet-500/15 text-violet-400 border-violet-500/30",
  ASSIGNED: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
  IN_PROGRESS: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  RESOLVED: "bg-green-500/15 text-green-400 border-green-500/30",
  CLOSED: "bg-gray-500/15 text-gray-400 border-gray-500/30",
};

export function relativeTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const diffMs = Date.now() - d.getTime();
  const mins = Math.round(diffMs / 60000);
  if (Math.abs(mins) < 60) return rtf(mins, "minute");
  const hours = Math.round(mins / 60);
  if (Math.abs(hours) < 24) return rtf(hours, "hour");
  return rtf(Math.round(hours / 24), "day");
}

function rtf(value: number, unit: Intl.RelativeTimeFormatUnit): string {
  return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(-value, unit);
}

export function formatMins(mins: number | null): string {
  if (mins == null) return "—";
  if (mins < 60) return `${Math.round(mins)}m`;
  if (mins < 1440) return `${(mins / 60).toFixed(1)}h`;
  return `${(mins / 1440).toFixed(1)}d`;
}
