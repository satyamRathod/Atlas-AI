import { ChevronDown, FileText } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import type { ChatCitation } from '@/types/chat';

interface SourcesPanelProps {
  citations: readonly ChatCitation[];
  messageId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function citationAnchorId(messageId: string, index: number): string {
  return `cite-${messageId}-${index}`;
}

export function SourcesPanel({ citations, messageId, open, onOpenChange }: SourcesPanelProps) {
  if (citations.length === 0) return null;

  return (
    <Collapsible open={open} onOpenChange={onOpenChange} className="w-full">
      <CollapsibleTrigger className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-xs font-medium">
        <FileText className="size-3.5" />
        Sources ({citations.length})
        <ChevronDown className={cn('size-3.5 transition-transform', open && 'rotate-180')} />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 flex flex-col gap-2">
        {citations.map((citation) => (
          <div
            key={citation.index}
            id={citationAnchorId(messageId, citation.index)}
            className="bg-muted/50 rounded-md border p-2.5 text-xs scroll-mt-4 target:ring-ring target:ring-2"
          >
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 font-medium">
                <Badge variant="outline" className="font-mono">
                  {citation.index}
                </Badge>
                {citation.title ?? citation.source}
              </span>
              <Badge variant="secondary" className="font-mono">
                {(citation.score * 100).toFixed(0)}%
              </Badge>
            </div>
            <p className="text-muted-foreground truncate font-mono">{citation.source}</p>
            <p className="text-foreground/80 mt-1.5 leading-relaxed">{citation.snippet}</p>
          </div>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}
