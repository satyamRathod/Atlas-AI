import {
  Brain,
  CheckCircle2,
  ChevronDown,
  FlagTriangleRight,
  Loader2,
  XCircle,
} from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import type { AgentStepDisplay } from '@/types/chat';

interface AgentReasoningTimelineProps {
  steps?: readonly AgentStepDisplay[];
}

function formatMs(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(2)}s`;
}

function statusColor(status: AgentStepDisplay['status']): string {
  if (status === 'success') return 'bg-emerald-500';
  if (status === 'error') return 'bg-destructive';
  if (status === 'final') return 'bg-violet-500';
  return 'bg-blue-500 animate-pulse';
}

function StatusIcon({ status }: { status: AgentStepDisplay['status'] }) {
  if (status === 'success') return <CheckCircle2 className="size-3.5 text-emerald-600" />;
  if (status === 'error') return <XCircle className="text-destructive size-3.5" />;
  if (status === 'final') return <FlagTriangleRight className="size-3.5 text-violet-600" />;
  return <Loader2 className="size-3.5 animate-spin text-blue-600" />;
}

function AgentStepRow({ step }: { step: AgentStepDisplay }) {
  const [open, setOpen] = useState(false);
  const hasDetails = step.action !== undefined;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger
        disabled={!hasDetails}
        className={cn(
          'bg-muted/50 flex w-full items-start justify-between gap-2 rounded-md border px-2.5 py-1.5 text-xs',
          !hasDetails && 'cursor-default',
        )}
      >
        <span className="flex min-w-0 items-start gap-2 text-left">
          <span className="pt-0.5">
            <StatusIcon status={step.status} />
          </span>
          <span className="flex min-w-0 flex-col gap-1">
            <span className="leading-relaxed">{step.thought}</span>
            {step.action && (
              <span className="text-muted-foreground truncate font-mono text-[11px]">
                → {step.action}
              </span>
            )}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2 pt-0.5">
          {step.durationMs !== undefined && (
            <span className="text-muted-foreground font-mono">{formatMs(step.durationMs)}</span>
          )}
          {hasDetails && (
            <ChevronDown className={cn('size-3.5 transition-transform', open && 'rotate-180')} />
          )}
        </span>
      </CollapsibleTrigger>
      {hasDetails && (
        <CollapsibleContent className="mt-1.5 flex flex-col gap-1.5 pl-2">
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground text-[11px] font-medium">Action Input</span>
            <pre className="bg-muted/50 max-h-40 overflow-auto rounded-md border p-2 text-[11px] whitespace-pre-wrap">
              {JSON.stringify(step.actionInput ?? {}, null, 2)}
            </pre>
          </div>
          {step.status === 'success' && (
            <div className="flex flex-col gap-1">
              <span className="text-muted-foreground text-[11px] font-medium">Observation</span>
              <pre className="bg-muted/50 max-h-40 overflow-auto rounded-md border p-2 text-[11px] whitespace-pre-wrap">
                {JSON.stringify(step.observation, null, 2)}
              </pre>
            </div>
          )}
          {step.status === 'error' && step.error && (
            <div className="flex flex-col gap-1">
              <span className="text-muted-foreground text-[11px] font-medium">Error</span>
              <p className="text-destructive bg-destructive/10 rounded-md border border-destructive/30 p-2 text-[11px]">
                {step.error}
              </p>
            </div>
          )}
        </CollapsibleContent>
      )}
    </Collapsible>
  );
}

/**
 * Agent reasoning timeline (Phase 6 UI) — a live waterfall of every ReAct
 * step this turn took, mirroring `ToolTimeline`'s shape but with the
 * **thought text shown inline** (not just on expand — reasoning is the
 * point of this loop, see docs/phases/phase-6-agents.md §2). `use-chat.ts`'s
 * `onAgentThought` appends a row (`status: 'acting'` if it has an action,
 * `'final'` if not — the terminal step); `onAgentObservation` updates that
 * row in place; `onDone` reconciles with the authoritative `agentRun.steps`.
 * Covers both "Agent reasoning timeline" and "Intermediate outputs" in one
 * component, the same way `ToolTimeline` folds multiple Phase 5 roadmap
 * bullets into one.
 */
export function AgentReasoningTimeline({ steps }: AgentReasoningTimelineProps) {
  const [open, setOpen] = useState(true);

  if (!steps || steps.length === 0) return null;

  const totalMs = steps.reduce((sum, step) => sum + (step.durationMs ?? 0), 0);
  const errorCount = steps.filter((step) => step.status === 'error').length;
  const actingCount = steps.filter((step) => step.status === 'acting').length;

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="w-full">
      <CollapsibleTrigger className="text-muted-foreground hover:text-foreground flex flex-wrap items-center gap-1.5 text-xs font-medium">
        <Brain className="size-3.5" />
        Reasoning
        <Badge variant="outline" className="font-mono">
          {steps.length} step{steps.length === 1 ? '' : 's'}
        </Badge>
        {actingCount > 0 && <Badge variant="secondary">{actingCount} in progress</Badge>}
        {errorCount > 0 && <Badge variant="destructive">{errorCount} failed</Badge>}
        {totalMs > 0 && <span className="font-mono">{formatMs(totalMs)}</span>}
        <ChevronDown className={cn('size-3.5 transition-transform', open && 'rotate-180')} />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 flex flex-col gap-2">
        <div className="flex h-2 w-full overflow-hidden rounded-full border">
          {steps.map((step) => (
            <div
              key={step.index}
              className={statusColor(step.status)}
              style={{
                width: `${totalMs > 0 ? ((step.durationMs ?? 0) / totalMs) * 100 : 100 / steps.length}%`,
              }}
              title={`Step ${step.index + 1} — ${step.status}${step.durationMs !== undefined ? ` (${formatMs(step.durationMs)})` : ''}`}
            />
          ))}
        </div>
        <ul className="flex flex-col gap-1.5">
          {steps.map((step) => (
            <li key={step.index}>
              <AgentStepRow step={step} />
            </li>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}
