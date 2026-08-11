import { BookOpen, Brain, ChevronDown, Sparkles } from 'lucide-react';
import { useState } from 'react';

import { TokenBudgetPanel } from '@/components/chat/token-budget-panel';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import type { MemoryInfo } from '@/types/chat';

interface MemoryPanelProps {
  memory?: MemoryInfo;
}

function scorePercent(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score * 100)));
}

function pluralize(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

/** Summary viewer (Phase 3 UI) — the rolling summary `summarize-history.ts` maintains, with a badge distinguishing a fresh update from a carried-over summary. */
function SummarySection({ memory }: { memory: MemoryInfo }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5 text-xs font-medium">
        <BookOpen className="size-3.5" />
        Rolling summary
        {memory.summary && (
          <Badge variant={memory.summarized ? 'default' : 'outline'} className="font-normal">
            {memory.summarized ? 'Updated this turn' : 'Carried over'}
          </Badge>
        )}
      </div>
      {memory.summary ? (
        <p className="bg-muted/50 rounded-md border p-2.5 text-xs leading-relaxed whitespace-pre-wrap">
          {memory.summary}
        </p>
      ) : (
        <p className="text-muted-foreground text-xs">
          No summary yet — this conversation hasn't reached the summarization threshold.
        </p>
      )}
    </div>
  );
}

/** The semantic-memory facts `SemanticMemoryStore.search()` recalled for this question, each with its similarity score. */
function SemanticFactsSection({ memory }: { memory: MemoryInfo }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5 text-xs font-medium">
        <Sparkles className="size-3.5" />
        Semantic memory recalled for this question
      </div>
      {memory.semanticFacts.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {memory.semanticFacts.map((fact, index) => (
            <li
              // biome-ignore lint/suspicious/noArrayIndexKey: facts have no stable id, and order/identity can repeat across turns
              key={index}
              className="bg-muted/50 flex items-start justify-between gap-2 rounded-md border p-2 text-xs"
            >
              <span className="leading-relaxed">{fact.text}</span>
              <Badge variant="secondary" className="shrink-0 font-mono">
                {scorePercent(fact.score)}%
              </Badge>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-xs">No related facts recalled for this turn.</p>
      )}
    </div>
  );
}

/**
 * Memory inspector (Phase 3 UI) — a per-turn disclosure over the `memory`
 * block the chat API returns (docs/phases/phase-3-memory.md §8): how much
 * conversation history is in context, the rolling summary (summary
 * viewer), semantic facts recalled for the question, and the token-budget
 * math that shaped all of it (token budget panel + context window
 * visualization, in `TokenBudgetPanel`).
 */
export function MemoryPanel({ memory }: MemoryPanelProps) {
  const [open, setOpen] = useState(false);

  if (!memory) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="w-full">
      <CollapsibleTrigger className="text-muted-foreground hover:text-foreground flex flex-wrap items-center gap-1.5 text-xs font-medium">
        <Brain className="size-3.5" />
        Memory
        <Badge variant="outline" className="font-mono">
          {pluralize(memory.historyMessageCount, 'msg')}
        </Badge>
        <Badge variant="outline" className="font-mono">
          {memory.historyTokens.toLocaleString()} tok
        </Badge>
        {memory.summarized && <Badge variant="secondary">Summarized</Badge>}
        {memory.semanticFacts.length > 0 && (
          <Badge variant="secondary">
            {pluralize(memory.semanticFacts.length, 'fact')} recalled
          </Badge>
        )}
        <ChevronDown className={cn('size-3.5 transition-transform', open && 'rotate-180')} />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 flex flex-col gap-3">
        <SummarySection memory={memory} />
        <SemanticFactsSection memory={memory} />
        <TokenBudgetPanel tokenBudget={memory.tokenBudget} />
      </CollapsibleContent>
    </Collapsible>
  );
}
