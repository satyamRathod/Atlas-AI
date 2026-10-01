import type { ReactNode } from 'react';

import type { ObservabilityTurn } from '@/types/chat';

interface TokenCostChartsProps {
  turns: readonly ObservabilityTurn[];
}

function formatCost(usd: number | undefined): string {
  if (usd === undefined) return '—';
  if (usd === 0) return '$0';
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(3)}`;
}

/**
 * Simple CSS bar charts over recent turns — tokens and estimated cost.
 * No chart library dependency (same approach as EvaluationDashboard bars).
 */
export function TokenCostCharts({ turns }: TokenCostChartsProps) {
  if (turns.length === 0) {
    return <p className="text-muted-foreground text-xs">No turns to chart.</p>;
  }

  const recent = turns.slice(0, 20);
  const maxTokens = Math.max(1, ...recent.map((t) => t.usage?.total_tokens ?? 0));
  const maxCost = Math.max(0.000001, ...recent.map((t) => t.costUsd ?? 0));
  const maxLatency = Math.max(1, ...recent.map((t) => t.latency.totalMs));

  return (
    <div className="flex flex-col gap-5">
      <ChartSection title="Tokens (newest first)">
        {recent.map((turn) => {
          const tokens = turn.usage?.total_tokens ?? 0;
          const pct = Math.round((tokens / maxTokens) * 100);
          return (
            <BarRow
              key={`tok-${turn.turnId}`}
              label={truncate(turn.question, 36)}
              value={tokens === 0 ? '—' : tokens.toLocaleString()}
              pct={pct}
              tone="primary"
            />
          );
        })}
      </ChartSection>

      <ChartSection title="Estimated cost">
        {recent.map((turn) => {
          const cost = turn.costUsd ?? 0;
          const pct = Math.round((cost / maxCost) * 100);
          return (
            <BarRow
              key={`cost-${turn.turnId}`}
              label={truncate(turn.question, 36)}
              value={formatCost(turn.costUsd)}
              pct={turn.costUsd === undefined ? 0 : pct}
              tone="amber"
            />
          );
        })}
      </ChartSection>

      <ChartSection title="Latency">
        {recent.map((turn) => {
          const ms = turn.latency.totalMs;
          const pct = Math.round((ms / maxLatency) * 100);
          return (
            <BarRow
              key={`lat-${turn.turnId}`}
              label={truncate(turn.question, 36)}
              value={ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`}
              pct={pct}
              tone="slate"
            />
          );
        })}
      </ChartSection>
    </div>
  );
}

function ChartSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-muted-foreground text-xs font-medium">{title}</span>
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  );
}

function BarRow({
  label,
  value,
  pct,
  tone,
}: {
  label: string;
  value: string;
  pct: number;
  tone: 'primary' | 'amber' | 'slate';
}) {
  const barClass =
    tone === 'primary' ? 'bg-primary/70' : tone === 'amber' ? 'bg-amber-500/70' : 'bg-slate-500/60';

  return (
    <div className="flex items-center gap-2 text-[11px]">
      <span className="text-muted-foreground w-36 shrink-0 truncate" title={label}>
        {label}
      </span>
      <div className="bg-muted h-2 flex-1 overflow-hidden rounded-sm">
        <div
          className={`h-full rounded-sm ${barClass}`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
      <span className="w-14 shrink-0 text-right font-mono tabular-nums">{value}</span>
    </div>
  );
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}
