import { ChevronDown, Gauge } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import type { EvaluationMetricName, EvaluationRunInfo, MetricScore } from '@/types/chat';

interface EvaluationDashboardProps {
  evaluation?: EvaluationRunInfo;
  /** Optional title override — e.g. "Benchmark aggregates". */
  title?: string;
}

const METRIC_ORDER: readonly EvaluationMetricName[] = [
  'faithfulness',
  'precision',
  'recall',
  'hallucination',
  'correctness',
];

const METRIC_LABELS: Record<EvaluationMetricName, string> = {
  faithfulness: 'Faithfulness',
  precision: 'Precision',
  recall: 'Recall',
  hallucination: 'Hallucination',
  correctness: 'Correctness',
};

function scoreFor(scores: readonly MetricScore[], name: EvaluationMetricName): number | undefined {
  return scores.find((score) => score.name === name)?.score;
}

function formatScore(score: number): string {
  return `${Math.round(score * 100)}%`;
}

function scoreTone(name: EvaluationMetricName, score: number): string {
  // Hallucination rate: lower is better.
  const good = name === 'hallucination' ? score <= 0.2 : score >= 0.7;
  const mid = name === 'hallucination' ? score <= 0.5 : score >= 0.4;
  if (good) return 'border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400';
  if (mid) return 'border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400';
  return 'border-destructive/50 bg-destructive/10 text-destructive';
}

/**
 * Evaluation dashboard (Phase 9 UI) — aggregate score strip for a turn or
 * benchmark run. Distinct from `EvaluationScorecards`, which expands
 * per-metric claim detail.
 */
export function EvaluationDashboard({
  evaluation,
  title = 'Evaluation dashboard',
}: EvaluationDashboardProps) {
  const [open, setOpen] = useState(true);

  if (!evaluation) return null;

  const metrics = METRIC_ORDER.filter((name) => scoreFor(evaluation.scores, name) !== undefined);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="w-full">
      <CollapsibleTrigger className="text-muted-foreground hover:text-foreground flex flex-wrap items-center gap-1.5 text-xs font-medium">
        <Gauge className="size-3.5" />
        {title}
        <Badge variant="outline" className="font-mono">
          {evaluation.mode}
        </Badge>
        {evaluation.durationMs > 0 && (
          <span className="font-mono">
            {evaluation.durationMs < 1000
              ? `${evaluation.durationMs}ms`
              : `${(evaluation.durationMs / 1000).toFixed(1)}s`}
          </span>
        )}
        <ChevronDown className={cn('size-3.5 transition-transform', open && 'rotate-180')} />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-5">
        {metrics.map((name) => {
          const score = scoreFor(evaluation.scores, name) ?? 0;
          return (
            <div
              key={name}
              className={cn(
                'flex flex-col gap-0.5 rounded-md border px-2.5 py-2 text-xs',
                scoreTone(name, score),
              )}
            >
              <span className="font-medium">{METRIC_LABELS[name]}</span>
              <span className="font-mono text-sm">{formatScore(score)}</span>
            </div>
          );
        })}
      </CollapsibleContent>
    </Collapsible>
  );
}
