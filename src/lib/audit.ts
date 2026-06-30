import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

/** Records an immutable audit-trail entry. Never throws into the caller path. */
export async function writeAudit(entry: {
  actorId?: string | null;
  action: string;
  entity: string;
  entityId: string;
  diff?: Prisma.InputJsonValue;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: entry.actorId ?? null,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId,
        diff: entry.diff,
      },
    });
  } catch {
    // Audit logging must never break the primary operation.
  }
}
