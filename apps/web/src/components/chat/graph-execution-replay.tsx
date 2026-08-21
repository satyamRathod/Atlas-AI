import { ChevronDown, ChevronLeft, ChevronRight, Play } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import type { GraphNodeDisplay } from '@/types/chat';

interface GraphExecutionReplayProps {
  nodes?: readonly GraphNodeDisplay[];
  activeIndex: number | undefined;
  onActiveIndexChange: (index: number | undefined) => void;
}

function formatMs(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(2)}s`;
}

function statusDotColor(status: GraphNodeDisplay['status']): string {
  if (status === 'success') return 'bg-emerald-500';
  if (status === 'error') return 'bg-destructive';
  if (status === 'interrupted') return 'bg-amber-500';
  return 'bg-blue-500 animate-pulse';
}

/**
 * Graph execution replay (Phase 7 UI) — a scrubber over this turn's
 * node-by-node timeline (`message.graphNodes`). Stepping through it drives
 * `activeIndex`, which `GraphVisualization` (the sibling panel in
 * `message-bubble.tsx`) uses to re-highlight the corresponding node —
 * so "replay" here means walking the already-recorded path, not
 * re-running the graph.
 *
 * `activeIndex === undefined` means "follow the live/last node", which is
 * what a still-streaming turn wants; scrubbing pins to an explicit index
 * until "Jump to live" is pressed.
 */
export function GraphExecutionReplay({
  nodes,
  activeIndex,
  onActiveIndexChange,
}: GraphExecutionReplayProps) {
  const [open, setOpen] = useState(false);

  const lastIndex = (nodes?.length ?? 0) - 1;
  const resolvedIndex = activeIndex ?? lastIndex;
  const isLive = activeIndex === undefined;

  if (!nodes || nodes.length === 0) return null;

  const current = nodes[resolvedIndex];

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="w-full">
      <CollapsibleTrigger className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-xs font-medium">
        <Play className="size-3.5" />
        Execution replay
        <Badge variant="outline" className="font-mono">
          {resolvedIndex + 1}/{nodes.length}
        </Badge>
        <ChevronDown className={cn('size-3.5 transition-transform', open && 'rotate-180')} />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 flex flex-col gap-2">
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="icon"
            className="size-7"
            aria-label="Previous step"
            disabled={resolvedIndex <= 0}
            onClick={() => onActiveIndexChange(Math.max(0, resolvedIndex - 1))}
          >
            <ChevronLeft className="size-3.5" />
          </Button>
          <input
            type="range"
            min={0}
            max={lastIndex}
            step={1}
            value={resolvedIndex}
            onChange={(event) => onActiveIndexChange(Number(event.target.value))}
            className="h-1.5 flex-1 cursor-pointer accent-blue-600"
          />
          <Button
            variant="outline"
            size="icon"
            className="size-7"
            aria-label="Next step"
            disabled={resolvedIndex >= lastIndex}
            onClick={() => onActiveIndexChange(Math.min(lastIndex, resolvedIndex + 1))}
          >
            <ChevronRight className="size-3.5" />
          </Button>
          <Button
            variant={isLive ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 text-xs"
            onClick={() => onActiveIndexChange(undefined)}
            disabled={isLive}
          >
            Live
          </Button>
        </div>
        {current && (
          <div className="bg-muted/50 flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs">
            <span className={cn('size-2 shrink-0 rounded-full', statusDotColor(current.status))} />
            <span className="truncate font-mono">{current.nodeId}</span>
            <Badge variant="outline" className="shrink-0 capitalize">
              {current.status}
            </Badge>
            {current.durationMs !== undefined && (
              <span className="text-muted-foreground ml-auto shrink-0 font-mono">
                {formatMs(current.durationMs)}
              </span>
            )}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
