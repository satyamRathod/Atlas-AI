import { ChevronDown, Columns3, Eye, FileText, List } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import type { ChatCitation } from '@/types/chat';

interface SourcesPanelProps {
  citations: readonly ChatCitation[];
  messageId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ViewMode = 'list' | 'compare';

export function citationAnchorId(messageId: string, index: number): string {
  return `cite-${messageId}-${index}`;
}

/** Scores aren't always a 0-1 cosine similarity (see `to-retrieved-chunk.ts`), so clamp before rendering as a percentage bar. */
function scorePercent(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score * 100)));
}

function MetadataBadges({ citation }: { citation: ChatCitation }) {
  if (!citation.category && !citation.docType) return null;

  return (
    <>
      {citation.category && (
        <Badge variant="outline" className="capitalize">
          {citation.category}
        </Badge>
      )}
      {citation.docType && (
        <Badge variant="outline" className="capitalize">
          {citation.docType}
        </Badge>
      )}
    </>
  );
}

function ScoreBar({ score }: { score: number }) {
  const percent = scorePercent(score);
  return (
    <div className="flex min-w-[88px] items-center gap-2">
      <Progress value={percent} className="h-1.5 w-14" />
      <span className="font-mono text-xs tabular-nums">{percent}%</span>
    </div>
  );
}

function SourcePreviewDialog({ citation }: { citation: ChatCitation }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant="ghost"
        size="icon"
        className="size-6 shrink-0"
        aria-label="Preview source"
        onClick={() => setOpen(true)}
      >
        <Eye className="size-3.5" />
      </Button>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-6">
            <FileText className="size-4 shrink-0" />
            {citation.title ?? citation.source}
          </DialogTitle>
          <DialogDescription className="font-mono">{citation.source}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary" className="font-mono">
            {(citation.score * 100).toFixed(0)}% similarity
          </Badge>
          <MetadataBadges citation={citation} />
        </div>
        <pre className="bg-muted/50 max-h-96 overflow-auto rounded-md border p-3 text-xs leading-relaxed whitespace-pre-wrap">
          {citation.content}
        </pre>
      </DialogContent>
    </Dialog>
  );
}

function CitationListItem({ citation, messageId }: { citation: ChatCitation; messageId: string }) {
  return (
    <div
      id={citationAnchorId(messageId, citation.index)}
      className="bg-muted/50 rounded-md border p-2.5 text-xs scroll-mt-4 target:ring-ring target:ring-2"
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5 font-medium">
          <Badge variant="outline" className="font-mono">
            {citation.index}
          </Badge>
          <span className="truncate">{citation.title ?? citation.source}</span>
        </span>
        <div className="flex shrink-0 items-center gap-1.5">
          <ScoreBar score={citation.score} />
          <SourcePreviewDialog citation={citation} />
        </div>
      </div>
      <div className="mb-1 flex flex-wrap items-center gap-1">
        <span className="text-muted-foreground truncate font-mono">{citation.source}</span>
        <MetadataBadges citation={citation} />
      </div>
      <p className="text-foreground/80 mt-1.5 leading-relaxed">{citation.snippet}</p>
    </div>
  );
}

/** Grid layout emphasizing score bars and metadata side by side, for comparing candidate chunks at a glance. */
function ChunkComparisonGrid({
  citations,
  messageId,
}: {
  citations: readonly ChatCitation[];
  messageId: string;
}) {
  const maxScore = Math.max(...citations.map((c) => c.score), 0.0001);

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {citations.map((citation) => (
        <div
          key={citation.index}
          id={citationAnchorId(messageId, citation.index)}
          className="bg-muted/50 flex flex-col gap-2 rounded-md border p-2.5 text-xs scroll-mt-4 target:ring-ring target:ring-2"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-1.5 font-medium">
              <Badge
                variant={citation.score === maxScore ? 'default' : 'outline'}
                className="font-mono"
              >
                #{citation.index}
              </Badge>
              <span className="truncate">{citation.title ?? citation.source}</span>
            </span>
            <SourcePreviewDialog citation={citation} />
          </div>
          <ScoreBar score={citation.score} />
          <div className="flex flex-wrap items-center gap-1">
            <MetadataBadges citation={citation} />
          </div>
          <p className="text-foreground/80 line-clamp-3 leading-relaxed">{citation.snippet}</p>
        </div>
      ))}
    </div>
  );
}

export function SourcesPanel({ citations, messageId, open, onOpenChange }: SourcesPanelProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  if (citations.length === 0) return null;

  return (
    <Collapsible open={open} onOpenChange={onOpenChange} className="w-full">
      <div className="flex items-center justify-between gap-2">
        <CollapsibleTrigger className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-xs font-medium">
          <FileText className="size-3.5" />
          Sources ({citations.length})
          <ChevronDown className={cn('size-3.5 transition-transform', open && 'rotate-180')} />
        </CollapsibleTrigger>

        {open && citations.length > 1 && (
          <div className="flex items-center gap-0.5">
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="icon"
              className="size-6"
              aria-label="List view"
              onClick={() => setViewMode('list')}
            >
              <List className="size-3.5" />
            </Button>
            <Button
              variant={viewMode === 'compare' ? 'secondary' : 'ghost'}
              size="icon"
              className="size-6"
              aria-label="Compare chunks"
              onClick={() => setViewMode('compare')}
            >
              <Columns3 className="size-3.5" />
            </Button>
          </div>
        )}
      </div>
      <CollapsibleContent className="mt-2">
        {viewMode === 'compare' && citations.length > 1 ? (
          <ChunkComparisonGrid citations={citations} messageId={messageId} />
        ) : (
          <div className="flex flex-col gap-2">
            {citations.map((citation) => (
              <CitationListItem key={citation.index} citation={citation} messageId={messageId} />
            ))}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
