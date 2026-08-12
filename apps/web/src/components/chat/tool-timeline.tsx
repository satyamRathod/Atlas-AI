import { CheckCircle2, ChevronDown, Loader2, Wrench, XCircle } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import type { ToolCallDisplay } from '@/types/chat';

interface ToolTimelineProps {
  toolCalls?: readonly ToolCallDisplay[];
}

function formatMs(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(2)}s`;
}

function statusColor(status: ToolCallDisplay['status']): string {
  if (status === 'success') return 'bg-emerald-500';
  if (status === 'error') return 'bg-destructive';
  return 'bg-blue-500 animate-pulse';
}

function StatusIcon({ status }: { status: ToolCallDisplay['status'] }) {
  if (status === 'success') return <CheckCircle2 className="size-3.5 text-emerald-600" />;
  if (status === 'error') return <XCircle className="text-destructive size-3.5" />;
  return <Loader2 className="size-3.5 animate-spin text-blue-600" />;
}

function ToolCallRow({ call }: { call: ToolCallDisplay }) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="bg-muted/50 flex w-full items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-xs">
        <span className="flex min-w-0 items-center gap-2">
          <StatusIcon status={call.status} />
          <span className="truncate font-mono">{call.name}</span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {call.durationMs !== undefined && (
            <span className="text-muted-foreground font-mono">{formatMs(call.durationMs)}</span>
          )}
          <ChevronDown className={cn('size-3.5 transition-transform', open && 'rotate-180')} />
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-1.5 flex flex-col gap-1.5 pl-2">
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground text-[11px] font-medium">Input</span>
          <pre className="bg-muted/50 max-h-40 overflow-auto rounded-md border p-2 text-[11px] whitespace-pre-wrap">
            {JSON.stringify(call.args, null, 2)}
          </pre>
        </div>
        {call.status === 'success' && (
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground text-[11px] font-medium">Output</span>
            <pre className="bg-muted/50 max-h-40 overflow-auto rounded-md border p-2 text-[11px] whitespace-pre-wrap">
              {JSON.stringify(call.output, null, 2)}
            </pre>
          </div>
        )}
        {call.status === 'error' && call.error && (
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground text-[11px] font-medium">Error</span>
            <p className="text-destructive bg-destructive/10 rounded-md border border-destructive/30 p-2 text-[11px]">
              {call.error}
            </p>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

/**
 * Tool timeline (Phase 5 UI) — a live waterfall of every tool call this
 * turn made. `use-chat.ts`'s `onToolCall` appends a `running` row the
 * instant the model decides to call a tool; `onToolResult` updates that
 * row in place with its final status/duration/output; `onDone` reconciles
 * with the authoritative `toolCalls` array. Covers all four roadmap UI
 * items (timeline, input/output, latency, status) in one component, the
 * same way `GuardrailsPanel` covers input+output checks in one component.
 */
export function ToolTimeline({ toolCalls }: ToolTimelineProps) {
  const [open, setOpen] = useState(true);

  if (!toolCalls || toolCalls.length === 0) return null;

  const totalMs = toolCalls.reduce((sum, call) => sum + (call.durationMs ?? 0), 0);
  const errorCount = toolCalls.filter((call) => call.status === 'error').length;
  const runningCount = toolCalls.filter((call) => call.status === 'running').length;

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="w-full">
      <CollapsibleTrigger className="text-muted-foreground hover:text-foreground flex flex-wrap items-center gap-1.5 text-xs font-medium">
        <Wrench className="size-3.5" />
        Tool calls
        <Badge variant="outline" className="font-mono">
          {toolCalls.length}
        </Badge>
        {runningCount > 0 && <Badge variant="secondary">{runningCount} running</Badge>}
        {errorCount > 0 && <Badge variant="destructive">{errorCount} failed</Badge>}
        {totalMs > 0 && <span className="font-mono">{formatMs(totalMs)}</span>}
        <ChevronDown className={cn('size-3.5 transition-transform', open && 'rotate-180')} />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 flex flex-col gap-2">
        <div className="flex h-2 w-full overflow-hidden rounded-full border">
          {toolCalls.map((call) => (
            <div
              key={call.id}
              className={statusColor(call.status)}
              style={{
                width: `${totalMs > 0 ? ((call.durationMs ?? 0) / totalMs) * 100 : 100 / toolCalls.length}%`,
              }}
              title={`${call.name} — ${call.status}${call.durationMs !== undefined ? ` (${formatMs(call.durationMs)})` : ''}`}
            />
          ))}
        </div>
        <ul className="flex flex-col gap-1.5">
          {toolCalls.map((call) => (
            <li key={call.id}>
              <ToolCallRow call={call} />
            </li>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}
