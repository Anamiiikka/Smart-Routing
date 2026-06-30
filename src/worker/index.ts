import "dotenv/config";
import {
  getBoss,
  QUEUE_ROUTE_TICKET,
  QUEUE_SLA_SWEEP,
  type RouteTicketJob,
} from "@/lib/queue";
import { logger } from "@/lib/logger";
import { runSlaSweep } from "@/lib/sla-sweep";
import { processRouteTicket } from "@/worker/route-ticket";

const log = logger.child({ module: "worker" });

async function main() {
  const boss = await getBoss({ worker: true });
  log.info("Worker started; pg-boss connected");

  // Routing jobs (one ticket per job).
  await boss.work<RouteTicketJob>(QUEUE_ROUTE_TICKET, async ([job]) => {
    await processRouteTicket(job.data.ticketId);
  });

  // SLA breach sweep — runs on a schedule and can also be triggered manually.
  await boss.work(QUEUE_SLA_SWEEP, async () => {
    await runSlaSweep();
  });

  // Schedule the sweep every minute (cron). Idempotent across restarts.
  await boss.schedule(QUEUE_SLA_SWEEP, "* * * * *");

  log.info("Workers registered: route-ticket, sla-sweep (every minute)");
}

main().catch((err) => {
  log.error({ err }, "Worker crashed");
  process.exit(1);
});

// Graceful shutdown so in-flight jobs finish.
for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, async () => {
    log.info({ sig }, "Shutting down worker");
    try {
      const boss = await getBoss({ worker: true });
      await boss.stop();
    } finally {
      process.exit(0);
    }
  });
}
