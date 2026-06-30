"use client";

import { useEffect, useState } from "react";
import type { DashboardMetrics } from "@/lib/metrics";
import { Badge, Card, StatCard } from "@/components/ui";
import { PRIORITY_STYLES, STATUS_STYLES, formatMins } from "@/lib/ui-format";

export function DashboardClient({
  initial,
  showHealth,
}: {
  initial: DashboardMetrics;
  showHealth: boolean;
}) {
  const [metrics, setMetrics] = useState(initial);
  const [live, setLive] = useState(false);

  useEffect(() => {
    const es = new EventSource("/api/stream/metrics");
    es.onopen = () => setLive(true);
    es.onmessage = (e) => {
      try {
        setMetrics(JSON.parse(e.data));
      } catch {
        /* ignore malformed frame */
      }
    };
    es.onerror = () => setLive(false);
    return () => es.close();
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <Badge
          className={
            live
              ? "border-green-500/30 bg-green-500/15 text-green-400"
              : "border-border text-muted-foreground"
          }
        >
          {live ? "● Live" : "○ Reconnecting"}
        </Badge>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Open tickets" value={metrics.openTickets} />
        <StatCard
          label="SLA breaches"
          value={metrics.breachedTickets}
          tone={metrics.breachedTickets > 0 ? "danger" : "success"}
        />
        <StatCard
          label="Auto-routed"
          value={`${Math.round(metrics.autoRoutedPct)}%`}
          hint="of all tickets"
        />
        <StatCard
          label="Avg resolution"
          value={formatMins(metrics.avgResolutionMins)}
          hint={`first response ${formatMins(metrics.avgFirstResponseMins)}`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-sm font-semibold">By status</h2>
          <Breakdown
            data={metrics.byStatus}
            styles={STATUS_STYLES as Record<string, string>}
          />
        </Card>
        <Card>
          <h2 className="mb-3 text-sm font-semibold">By priority</h2>
          <Breakdown
            data={metrics.byPriority}
            styles={PRIORITY_STYLES as Record<string, string>}
          />
        </Card>
      </div>

      {showHealth && (
        <Card>
          <h2 className="mb-3 text-sm font-semibold">System health</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Queue depth"
              value={metrics.health.queueDepth}
              hint="pending routing jobs"
              tone={metrics.health.queueDepth > 20 ? "danger" : "default"}
            />
            <StatCard
              label="LLM latency"
              value={
                metrics.health.llmAvgLatencyMs == null
                  ? "—"
                  : `${metrics.health.llmAvgLatencyMs} ms`
              }
              hint="avg, last hour"
            />
            <StatCard
              label="LLM error rate"
              value={
                metrics.health.llmErrorRatePct == null
                  ? "—"
                  : `${metrics.health.llmErrorRatePct.toFixed(1)}%`
              }
              tone={(metrics.health.llmErrorRatePct ?? 0) > 5 ? "danger" : "success"}
              hint="last hour"
            />
            <StatCard
              label="Routed / hour"
              value={metrics.health.routedLastHour}
              hint="LLM decisions"
            />
          </div>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        Updated {new Date(metrics.generatedAt).toLocaleTimeString()}
      </p>
    </div>
  );
}

function Breakdown({
  data,
  styles,
}: {
  data: Record<string, number>;
  styles: Record<string, string>;
}) {
  const total = Object.values(data).reduce((a, b) => a + b, 0) || 1;
  return (
    <div className="space-y-2">
      {Object.entries(data).map(([key, count]) => (
        <div key={key} className="flex items-center gap-3">
          <Badge className={styles[key] ?? "border-border"}>{key}</Badge>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary/60"
              style={{ width: `${(count / total) * 100}%` }}
            />
          </div>
          <span className="w-8 text-right text-sm tabular-nums">{count}</span>
        </div>
      ))}
    </div>
  );
}
