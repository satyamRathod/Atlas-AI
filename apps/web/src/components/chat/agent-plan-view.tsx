import { ChevronDown, ListChecks } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

interface AgentPlanViewProps {
  plan?: readonly string[];
}

/**
 * Agent plan view (Phase 6 UI) — the upfront, ordered list of intended
 * steps `planner.ts` proposed before the ReAct loop started
 * (`agentRun.plan` / the live `agent_plan` SSE event). Shown as a small
 * disclosure above the reasoning timeline, mirroring
 * `VariableInspectorPanel`'s simplicity — this is a suggestion the agent
 * may deviate from, not a guarantee of what it actually did (see
 * `AgentReasoningTimeline` for that).
 */
export function AgentPlanView({ plan }: AgentPlanViewProps) {
  const [open, setOpen] = useState(false);

  if (!plan || plan.length === 0) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="w-full">
      <CollapsibleTrigger className="text-muted-foreground hover:text-foreground flex flex-wrap items-center gap-1.5 text-xs font-medium">
        <ListChecks className="size-3.5" />
        Plan
        <Badge variant="outline" className="font-mono">
          {plan.length} step{plan.length === 1 ? '' : 's'}
        </Badge>
        <ChevronDown className={cn('size-3.5 transition-transform', open && 'rotate-180')} />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2">
        <ol className="flex flex-col gap-1.5 pl-1">
          {plan.map((step, index) => (
            <li
              // biome-ignore lint/suspicious/noArrayIndexKey: plan steps have no stable id, only their position
              key={index}
              className="flex items-start gap-2 text-xs"
            >
              <span className="text-muted-foreground bg-muted/50 flex size-4.5 shrink-0 items-center justify-center rounded-full border font-mono text-[10px]">
                {index + 1}
              </span>
              <span className="pt-0.5 leading-relaxed">{step}</span>
            </li>
          ))}
        </ol>
      </CollapsibleContent>
    </Collapsible>
  );
}
