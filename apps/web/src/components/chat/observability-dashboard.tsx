import { Activity, Clock, Coins, Hash } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ObservabilityMetrics } from '@/types/chat';

interface ObservabilityDashboardProps {
  metrics?: ObservabilityMetrics;
  loading?: boolean;
}

function formatCost(usd: number): string {
  if (usd === 0) return '$0';
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(3)}`;
}

function formatLatency(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/**
 * Overview KPI strip + mode breakdown for Phase 10 observability metrics.
 */
export function ObservabilityDashboard({ metrics, loading }: ObservabilityDashboardProps) {
  if (loading && !metrics) {
    return <p className="text-muted-foreground text-xs">Loading metrics…</p>;
  }

  if (!metrics) {
    return (
      <p className="text-muted-foreground text-xs">
        No observability data yet. Send a chat message, then refresh.
      </p>
    );
  }

  const kpis = [
    {
      label: 'Requests',
      value: String(metrics.requestCount),
      icon: Activity,
    },
    {
      label: 'Tokens',
      value: metrics.totalTokens.toLocaleString(),
      icon: Hash,
    },
    {
      label: 'Est. cost',
      value: formatCost(metrics.totalCostUsd),
      icon: Coins,
    },
    {
      label: 'Avg latency',
      value: formatLatency(metrics.avgLatencyMs),
      icon: Clock,
    },
  ] as const;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="border-border/60 bg-muted/30 flex flex-col gap-1 rounded-md border px-3 py-2.5"
          >
            <span className="text-muted-foreground flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide">
              <kpi.icon className="size-3" />
              {kpi.label}
            </span>
            <span className="font-mono text-lg tabular-nums">{kpi.value}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <div className="text-muted-foreground flex items-center gap-2 text-xs font-medium">
          Mode breakdown
          <Badge variant="outline" className="font-mono">
            n={metrics.sampleSize}
          </Badge>
        </div>
        {metrics.byMode.length === 0 ? (
          <p className="text-muted-foreground text-xs">No modes recorded.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {metrics.byMode.map((row) => {
              const pct =
                metrics.requestCount === 0
                  ? 0
                  : Math.round((row.count / metrics.requestCount) * 100);
              return (
                <div key={row.mode} className="flex items-center gap-2 text-xs">
                  <span className="w-24 shrink-0 font-mono">{row.mode}</span>
                  <div className="bg-muted h-2 flex-1 overflow-hidden rounded-sm">
                    <div
                      className={cn('bg-primary/70 h-full rounded-sm')}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-muted-foreground w-16 shrink-0 text-right font-mono">
                    {row.count} ({pct}%)
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {metrics.retrievalStageAvgMs.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-muted-foreground text-xs font-medium">Retrieval stage avg</span>
          <div className="flex flex-wrap gap-1.5">
            {metrics.retrievalStageAvgMs.map((stage) => (
              <Badge key={stage.name} variant="outline" className="font-mono text-[11px]">
                {stage.name}: {formatLatency(stage.durationMs)}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
