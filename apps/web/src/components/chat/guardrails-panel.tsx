import { AlertTriangle, ChevronDown, ShieldCheck, ShieldX } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import type { GuardrailReport, GuardrailResult } from '@/types/chat';

interface GuardrailsPanelProps {
  guardrails?: GuardrailReport;
}

function CheckRow({ result }: { result: GuardrailResult }) {
  return (
    <li className="bg-muted/50 flex items-start gap-2 rounded-md border p-2 text-xs">
      {result.passed ? (
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
      ) : (
        <ShieldX className="text-destructive mt-0.5 size-3.5 shrink-0" />
      )}
      <div className="flex flex-col gap-0.5">
        <span className="font-mono">{result.name}</span>
        {result.message && <span className="text-muted-foreground">{result.message}</span>}
      </div>
    </li>
  );
}

/**
 * Guardrails panel (Phase 4 UI) — per-check pass/fail results
 * (`guardrails.input`/`guardrails.output`,
 * docs/phases/phase-4-prompt-engineering.md §5), with a banner when
 * `blocked: true` (the reply is a synthesized refusal, not a real model
 * response).
 */
export function GuardrailsPanel({ guardrails }: GuardrailsPanelProps) {
  const [open, setOpen] = useState(false);

  if (!guardrails) return null;

  const failedCount =
    guardrails.input.filter((r) => !r.passed).length +
    guardrails.output.filter((r) => !r.passed).length;

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="w-full">
      {guardrails.blocked && (
        <div className="border-destructive/30 bg-destructive/10 text-destructive mb-2 flex items-center gap-1.5 rounded-md border p-2 text-xs">
          <AlertTriangle className="size-3.5 shrink-0" />
          This reply was blocked by an input guardrail — no model call was made.
        </div>
      )}
      <CollapsibleTrigger className="text-muted-foreground hover:text-foreground flex flex-wrap items-center gap-1.5 text-xs font-medium">
        {guardrails.blocked ? (
          <ShieldX className="size-3.5" />
        ) : (
          <ShieldCheck className="size-3.5" />
        )}
        Guardrails
        {failedCount > 0 ? (
          <Badge variant="destructive">{failedCount} flagged</Badge>
        ) : (
          <Badge variant="outline">All passed</Badge>
        )}
        <ChevronDown className={cn('size-3.5 transition-transform', open && 'rotate-180')} />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-muted-foreground text-xs font-medium">Input checks</span>
          <ul className="flex flex-col gap-1.5">
            {guardrails.input.map((result) => (
              <CheckRow key={result.name} result={result} />
            ))}
          </ul>
        </div>
        {guardrails.output.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-muted-foreground text-xs font-medium">Output checks</span>
            <ul className="flex flex-col gap-1.5">
              {guardrails.output.map((result) => (
                <CheckRow key={result.name} result={result} />
              ))}
            </ul>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
