import { ChevronDown, Terminal } from 'lucide-react';
import { useState } from 'react';

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import type { ChatCitation } from '@/types/chat';

interface PromptPreviewPanelProps {
  citations: readonly ChatCitation[];
}

/**
 * Reconstructs the numbered, source-tagged context block that the backend
 * injects into the RAG prompt (see apps/api chat.service.ts `buildContext`),
 * from the citation data returned before generation. Shows what the model
 * was grounded on for this turn, not the full system-prompt instructions.
 */
export function PromptPreviewPanel({ citations }: PromptPreviewPanelProps) {
  const [open, setOpen] = useState(false);

  if (citations.length === 0) return null;

  const contextBlock = citations
    .map((c) => `[${c.index}] (source: ${c.source})\n${c.snippet}`)
    .join('\n\n');

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="w-full">
      <CollapsibleTrigger className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-xs font-medium">
        <Terminal className="size-3.5" />
        Prompt context
        <ChevronDown className={cn('size-3.5 transition-transform', open && 'rotate-180')} />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2">
        <pre className="bg-muted/50 max-h-64 overflow-auto rounded-md border p-2.5 text-xs whitespace-pre-wrap">
          {contextBlock}
        </pre>
      </CollapsibleContent>
    </Collapsible>
  );
}
