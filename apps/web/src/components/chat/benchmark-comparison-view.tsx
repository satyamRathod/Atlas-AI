import { ChevronDown, Columns2 } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import type { BenchmarkRunSummary, EvaluationMetricName, MetricScore } from '@/types/chat';

interface BenchmarkComparisonViewProps {
  runA?: BenchmarkRunSummary;
  runB?: BenchmarkRunSummary;
}

const METRIC_ORDER: readonly EvaluationMetricName[] = [
  'faithfulness',
  'precision',
  'recall',
  'hallucination',
  'correctness',
];

function scoreMap(scores: readonly MetricScore[]): Map<EvaluationMetricName, number> {
  return new Map(scores.map((score) => [score.name, score.score]));
}

function formatScore(score: number | undefined): string {
  if (score === undefined) return '—';
  return `${Math.round(score * 100)}%`;
}

function RunPane({ label, run }: { label: string; run?: BenchmarkRunSummary }) {
  if (!run) {
    return (
      <div className="text-muted-foreground flex min-w-0 flex-1 flex-col gap-1.5 rounded-md border p-2.5 text-xs italic">
        {label}: not selected
      </div>
    );
  }

  const map = scoreMap(run.aggregateScores);

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5 rounded-md border p-2.5 text-xs">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="outline">{label}</Badge>
        <span className="font-mono text-[10px]">{run.runId.slice(0, 8)}</span>
        <Badge variant="secondary" className="font-mono">
          {run.caseCount} cases
        </Badge>
      </div>
      <ul className="flex flex-col gap-1">
        {METRIC_ORDER.filter((name) => map.has(name)).map((name) => (
          <li key={name} className="flex items-center justify-between gap-2 capitalize">
            <span>{name}</span>
            <span className="font-mono">{formatScore(map.get(name))}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Benchmark comparison (Phase 9 UI) — side-by-side aggregate scores for two
 * persisted benchmark runs (mirrors Output Comparison's two-pane layout).
 */
export function BenchmarkComparisonView({ runA, runB }: BenchmarkComparisonViewProps) {
  const [open, setOpen] = useState(true);

  if (!runA && !runB) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="w-full">
      <CollapsibleTrigger className="text-muted-foreground hover:text-foreground flex flex-wrap items-center gap-1.5 text-xs font-medium">
        <Columns2 className="size-3.5" />
        Benchmark comparison
        <ChevronDown className={cn('size-3.5 transition-transform', open && 'rotate-180')} />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 flex flex-col gap-2 sm:flex-row">
        <RunPane label="Run A" run={runA} />
        <RunPane label="Run B" run={runB} />
      </CollapsibleContent>
    </Collapsible>
  );
}
