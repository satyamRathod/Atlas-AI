import { ChevronDown, GitBranch } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import type { RetrievalInfo } from '@/types/chat';

interface RetrievalTimelineProps {
  retrieval?: RetrievalInfo;
}

const STAGE_COLORS = [
  'bg-primary',
  'bg-blue-500',
  'bg-amber-500',
  'bg-emerald-500',
  'bg-violet-500',
];

function stageColor(index: number): string {
  return STAGE_COLORS[index % STAGE_COLORS.length] ?? 'bg-primary';
}

function formatMs(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(2)}s`;
}

function formatStageName(name: string): string {
  return name
    .split(/[_+]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(name.includes('+') ? ' + ' : ' ');
}

/**
 * Retrieval timeline (Phase 2 UI) — visualizes each stage the retrieval
 * pipeline actually ran (query expansion, base strategy, rerank/compression)
 * as a proportional waterfall, using the `stages` timing data the backend
 * already collects in `create-advanced-retriever.ts`.
 */
export function RetrievalTimeline({ retrieval }: RetrievalTimelineProps) {
  const [open, setOpen] = useState(false);

  if (!retrieval || retrieval.stages.length === 0) return null;

  const totalMs = retrieval.stages.reduce((sum, stage) => sum + stage.durationMs, 0);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="w-full">
      <CollapsibleTrigger className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-xs font-medium">
        <GitBranch className="size-3.5" />
        Retrieval timeline
        <Badge variant="outline" className="font-mono">
          {retrieval.strategy}
        </Badge>
        <span className="font-mono">{formatMs(totalMs)}</span>
        <ChevronDown className={cn('size-3.5 transition-transform', open && 'rotate-180')} />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 flex flex-col gap-2">
        <div className="flex h-2 w-full overflow-hidden rounded-full border">
          {retrieval.stages.map((stage, index) => (
            <div
              key={stage.name}
              className={stageColor(index)}
              style={{ width: `${totalMs > 0 ? (stage.durationMs / totalMs) * 100 : 0}%` }}
              title={`${formatStageName(stage.name)} — ${formatMs(stage.durationMs)}`}
            />
          ))}
        </div>
        <ul className="flex flex-col gap-1.5">
          {retrieval.stages.map((stage, index) => (
            <li
              key={stage.name}
              className="bg-muted/50 flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-xs"
            >
              <span className="flex items-center gap-2">
                <span className={cn('size-2 shrink-0 rounded-full', stageColor(index))} />
                {formatStageName(stage.name)}
              </span>
              <span className="text-muted-foreground font-mono">{formatMs(stage.durationMs)}</span>
            </li>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}
