import { CheckCircle2, ChevronDown, Columns2, XCircle } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import type { DraftVersion, ReviewVerdict } from '@/types/chat';

interface OutputComparisonViewProps {
  draftHistory?: readonly DraftVersion[];
  reviewHistory?: readonly ReviewVerdict[];
}

/**
 * The reviewer verdict that caused `draftHistory[index]` to be written —
 * the most recent review between the previous draft's round and this
 * draft's round. `undefined` for the first draft (nothing preceded it) or
 * when the writer revised without an intervening review for some reason.
 */
function findTriggeringReview(
  draftHistory: readonly DraftVersion[],
  reviewHistory: readonly ReviewVerdict[],
  index: number,
): ReviewVerdict | undefined {
  if (index === 0) return undefined;
  const previousRound = draftHistory[index - 1]?.round ?? -1;
  const currentRound = draftHistory[index]?.round ?? Number.POSITIVE_INFINITY;
  const between = reviewHistory.filter(
    (review) => review.round > previousRound && review.round < currentRound,
  );
  return between.at(-1);
}

function DraftPane({ label, draft }: { label: string; draft?: DraftVersion }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5 rounded-md border p-2.5">
      <span className="text-muted-foreground flex items-center gap-1.5 text-[11px] font-medium">
        {label}
        {draft && (
          <Badge variant="outline" className="font-mono text-[10px]">
            round {draft.round}
          </Badge>
        )}
      </span>
      {draft ? (
        <p className="max-h-48 overflow-auto text-xs leading-relaxed whitespace-pre-wrap">
          {draft.content}
        </p>
      ) : (
        <p className="text-muted-foreground text-xs italic">No earlier draft.</p>
      )}
    </div>
  );
}

function FeedbackBanner({ review }: { review?: ReviewVerdict }) {
  if (!review) return null;

  return (
    <div
      className={cn(
        'flex items-start gap-1.5 rounded-md border px-2.5 py-1.5 text-xs',
        review.approved
          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
          : 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400',
      )}
    >
      {review.approved ? (
        <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" />
      ) : (
        <XCircle className="mt-0.5 size-3.5 shrink-0" />
      )}
      <span className="leading-relaxed">
        <span className="font-medium">
          {review.approved ? 'Approved' : 'Rejected'} (round {review.round}).
        </span>{' '}
        {review.feedback && <span>{review.feedback}</span>}
      </span>
    </div>
  );
}

/**
 * Output comparison (Phase 8 UI) — the roadmap's **Output comparison**
 * item: a version selector over `draftHistory` (one entry per `writer`
 * visit) showing the selected draft side by side with the one before it,
 * plus the reviewer feedback that triggered the revision in between —
 * mirrors `PromptComparisonDialog`'s two-pane layout, but comparing
 * successive versions of *one* answer instead of two independent runs.
 *
 * A single-draft turn (the common case — no revision needed) still
 * renders, just as one pane with no "previous" side and no feedback
 * banner, so the panel isn't gated behind "did the reviewer ever reject
 * anything."
 */
export function OutputComparisonView({
  draftHistory,
  reviewHistory = [],
}: OutputComparisonViewProps) {
  const [open, setOpen] = useState(draftHistory !== undefined && draftHistory.length > 1);
  const [selected, setSelected] = useState(0);

  if (!draftHistory || draftHistory.length === 0) return null;

  const lastIndex = draftHistory.length - 1;
  const index = Math.min(selected, lastIndex);
  const current = draftHistory[index];
  const previous = index > 0 ? draftHistory[index - 1] : undefined;
  const triggeringReview = findTriggeringReview(draftHistory, reviewHistory, index);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="w-full">
      <CollapsibleTrigger className="text-muted-foreground hover:text-foreground flex flex-wrap items-center gap-1.5 text-xs font-medium">
        <Columns2 className="size-3.5" />
        Output comparison
        <Badge variant="outline" className="font-mono">
          {draftHistory.length} version{draftHistory.length === 1 ? '' : 's'}
        </Badge>
        <ChevronDown className={cn('size-3.5 transition-transform', open && 'rotate-180')} />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 flex flex-col gap-2">
        {draftHistory.length > 1 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {draftHistory.map((draft, draftIndex) => (
              <Button
                key={draft.round}
                variant={draftIndex === index ? 'secondary' : 'outline'}
                size="sm"
                className="h-6 px-2 text-[11px]"
                onClick={() => setSelected(draftIndex)}
              >
                v{draftIndex + 1}
              </Button>
            ))}
          </div>
        )}

        {previous ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <DraftPane label="Previous" draft={previous} />
            <DraftPane label="Selected" draft={current} />
          </div>
        ) : (
          <DraftPane label="Draft" draft={current} />
        )}

        <FeedbackBanner review={triggeringReview} />
      </CollapsibleContent>
    </Collapsible>
  );
}
