import { ChevronDown, SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import type { PromptInfo } from '@/types/chat';

interface VariableInspectorPanelProps {
  promptInfo?: PromptInfo;
}

const VARIABLE_ROWS: readonly { key: keyof PromptInfo['variables']; label: string }[] = [
  { key: 'question', label: 'question' },
  { key: 'context', label: 'context' },
  { key: 'summary', label: 'summary' },
  { key: 'memory', label: 'memory' },
];

/**
 * Variable inspector (Phase 4 UI) — the *resolved* variables the backend
 * actually rendered into this turn's prompt (`promptInfo.variables`,
 * docs/phases/phase-4-prompt-engineering.md §6), read straight from the
 * response instead of reconstructed/guessed client-side the way
 * `PromptPreviewPanel` (Phase 1/2) has to for `{context}` alone.
 */
export function VariableInspectorPanel({ promptInfo }: VariableInspectorPanelProps) {
  const [open, setOpen] = useState(false);

  if (!promptInfo) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="w-full">
      <CollapsibleTrigger className="text-muted-foreground hover:text-foreground flex flex-wrap items-center gap-1.5 text-xs font-medium">
        <SlidersHorizontal className="size-3.5" />
        Variables
        <Badge variant="outline" className="font-mono">
          {promptInfo.templateName} v{promptInfo.version}
        </Badge>
        {promptInfo.usedFewShot && <Badge variant="secondary">Few-shot</Badge>}
        <ChevronDown className={cn('size-3.5 transition-transform', open && 'rotate-180')} />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 flex flex-col gap-2">
        {VARIABLE_ROWS.map((row) => (
          <div key={row.key} className="flex flex-col gap-1">
            <span className="text-muted-foreground font-mono text-[11px]">{`{${row.label}}`}</span>
            <pre className="bg-muted/50 max-h-40 overflow-auto rounded-md border p-2.5 text-xs whitespace-pre-wrap">
              {promptInfo.variables[row.key] || '—'}
            </pre>
          </div>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}
