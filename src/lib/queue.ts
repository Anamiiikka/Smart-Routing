import PgBoss from "pg-boss";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

export const QUEUE_ROUTE_TICKET = "route-ticket";
export const QUEUE_SLA_SWEEP = "sla-sweep";

export interface RouteTicketJob {
  ticketId: string;
}

const log = logger.child({ module: "queue" });

let bossPromise: Promise<PgBoss> | null = null;

/**
 * Returns a started pg-boss instance (singleton per process).
 *
 * - The web app calls this in "send-only" mode (no maintenance/scheduling) just
 *   to enqueue jobs.
 * - The worker process passes `{ worker: true }` to enable maintenance,
 *   scheduling, and job archival.
 *
 * Uses DIRECT_URL because pg-boss relies on LISTEN/NOTIFY and advisory locks,
 * which the Neon pooler does not support.
 */
export function getBoss(opts?: { worker?: boolean }): Promise<PgBoss> {
  if (!bossPromise) {
    const isWorker = opts?.worker ?? false;
    const boss = new PgBoss({
      connectionString: env.DIRECT_URL,
      schema: "pgboss",
      // Only the worker should run maintenance + the scheduler.
      supervise: isWorker,
      schedule: isWorker,
      migrate: isWorker,
      max: isWorker ? 5 : 2,
    });
    boss.on("error", (e) => log.error({ err: e }, "pg-boss error"));

    bossPromise = (async () => {
      await boss.start();
      // Queues must exist before send()/work() in pg-boss v10. Idempotent.
      await ensureQueues(boss);
      return boss;
    })();
  }
  return bossPromise;
}

async function ensureQueues(boss: PgBoss) {
  const opts = { retryLimit: 3, retryBackoff: true } as const;
  for (const name of [QUEUE_ROUTE_TICKET, QUEUE_SLA_SWEEP]) {
    const existing = await boss.getQueue(name);
    if (!existing) await boss.createQueue(name, { name, ...opts });
  }
}

/** Enqueue an async routing job for a freshly created ticket. */
export async function enqueueRouteTicket(data: RouteTicketJob): Promise<void> {
  const boss = await getBoss();
  await boss.send(QUEUE_ROUTE_TICKET, data);
  log.info({ ticketId: data.ticketId }, "Enqueued route-ticket job");
}
