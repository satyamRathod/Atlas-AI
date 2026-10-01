import { ArrowRight, ChevronDown, MessagesSquare } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import type { AgentMessage } from '@/types/chat';

interface AgentCommunicationTimelineProps {
  communicationLog?: readonly AgentMessage[];
}

function MessageRow({ message, index }: { message: AgentMessage; index: number }) {
  const [open, setOpen] = useState(false);
  const isLong = message.content.length > 140;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger
        disabled={!isLong}
        className={cn(
          'bg-muted/50 flex w-full items-start justify-between gap-2 rounded-md border px-2.5 py-1.5 text-xs',
          !isLong && 'cursor-default',
        )}
      >
        <span className="flex min-w-0 items-start gap-2 text-left">
          <Badge variant="outline" className="mt-0.5 shrink-0 font-mono">
            #{index}
          </Badge>
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="flex items-center gap-1 font-medium">
              <span className="capitalize">{message.from}</span>
              <ArrowRight className="size-3 shrink-0" />
              <span className="capitalize">{message.to}</span>
              <Badge variant="secondary" className="ml-1 font-mono text-[10px]">
                round {message.round}
              </Badge>
            </span>
            <span className={cn('text-muted-foreground leading-relaxed', !open && 'line-clamp-2')}>
              {message.content}
            </span>
          </span>
        </span>
        {isLong && (
          <ChevronDown
            className={cn('mt-0.5 size-3.5 shrink-0 transition-transform', open && 'rotate-180')}
          />
        )}
      </CollapsibleTrigger>
    </Collapsible>
  );
}

/**
 * Agent communication timeline (Phase 8 UI) — the roadmap's **Agent
 * communication timeline** item: a chronological, expandable list of
 * `communicationLog` entries (who told whom what, each round) — the
 * literal "conversation between agents" (§0.1 of
 * docs/phases/phase-8-multi-agent.md), mirroring `AgentReasoningTimeline`'s
 * waterfall shape but for a multi-party exchange instead of one actor's
 * thoughts.
 *
 * Unlike `MultiAgentDashboard`/`ToolTimeline`, this can't update live turn
 * by turn — the backend only emits `communicationLog` in full as part of
 * the final `multiAgentRun` (§7 of docs/phases/phase-8-multi-agent.md), not
 * as an incremental SSE event — so it renders once `message.multiAgentRun`
 * arrives on `done`, not during streaming.
 */
export function AgentCommunicationTimeline({ communicationLog }: AgentCommunicationTimelineProps) {
  const [open, setOpen] = useState(true);

  if (!communicationLog || communicationLog.length === 0) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="w-full">
      <CollapsibleTrigger className="text-muted-foreground hover:text-foreground flex flex-wrap items-center gap-1.5 text-xs font-medium">
        <MessagesSquare className="size-3.5" />
        Agent communication
        <Badge variant="outline" className="font-mono">
          {communicationLog.length} message{communicationLog.length === 1 ? '' : 's'}
        </Badge>
        <ChevronDown className={cn('size-3.5 transition-transform', open && 'rotate-180')} />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2">
        <ul className="flex flex-col gap-1.5">
          {communicationLog.map((message, index) => (
            <li key={`${message.round}-${message.from}-${message.to}-${message.content}`}>
              <MessageRow message={message} index={index} />
            </li>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}
