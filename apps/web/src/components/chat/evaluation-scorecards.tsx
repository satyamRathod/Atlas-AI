import { CheckCircle2, ChevronDown, ClipboardList, XCircle } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import type { ClaimVerdict, EvaluationRunInfo } from '@/types/chat';

interface EvaluationScorecardsProps {
  evaluation?: EvaluationRunInfo;
}

function formatScore(score: number): string {
  return `${Math.round(score * 100)}%`;
}

function ClaimList({ claims, empty }: { claims: readonly ClaimVerdict[]; empty: string }) {
  if (claims.length === 0) {
    return <p className="text-muted-foreground text-[11px] italic">{empty}</p>;
  }

  return (
    <ul className="flex flex-col gap-1">
      {claims.map((claim) => (
        <li
          key={`${claim.support}-${claim.claim}`}
          className="bg-muted/40 rounded-md border px-2 py-1.5 text-[11px]"
        >
          <span className="flex items-start gap-1.5">
            {claim.support === 'supported' ? (
              <CheckCircle2 className="mt-0.5 size-3 shrink-0 text-emerald-600" />
            ) : (
              <XCircle className="text-destructive mt-0.5 size-3 shrink-0" />
            )}
            <span className="min-w-0">
              <Badge variant="outline" className="mb-0.5 capitalize">
                {claim.support}
              </Badge>
              <span className="block leading-relaxed">{claim.claim}</span>
              {claim.rationale && (
                <span className="text-muted-foreground mt-0.5 block">{claim.rationale}</span>
              )}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function Scorecard({
  title,
  score,
  children,
}: {
  title: string;
  score: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="bg-muted/50 flex w-full items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-xs">
        <span className="font-medium">{title}</span>
        <span className="flex items-center gap-1.5">
          <span className="font-mono">{score}</span>
          <ChevronDown className={cn('size-3.5 transition-transform', open && 'rotate-180')} />
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-1.5 pl-1">{children}</CollapsibleContent>
    </Collapsible>
  );
}

/**
 * Evaluation scorecards (Phase 9 UI) — expandable per-metric detail
 * (claims, citation relevance, GT coverage) under the dashboard strip.
 */
export function EvaluationScorecards({ evaluation }: EvaluationScorecardsProps) {
  const [open, setOpen] = useState(false);

  if (!evaluation) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="w-full">
      <CollapsibleTrigger className="text-muted-foreground hover:text-foreground flex flex-wrap items-center gap-1.5 text-xs font-medium">
        <ClipboardList className="size-3.5" />
        Scorecards
        <Badge variant="outline" className="font-mono">
          {evaluation.scores.length} metrics
        </Badge>
        <ChevronDown className={cn('size-3.5 transition-transform', open && 'rotate-180')} />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 flex flex-col gap-1.5">
        <Scorecard title="Faithfulness" score={formatScore(evaluation.faithfulness.score)}>
          <p className="text-muted-foreground mb-1 text-[11px]">
            {evaluation.faithfulness.supportedCount} supported ·{' '}
            {evaluation.faithfulness.unsupportedCount} unsupported ·{' '}
            {evaluation.faithfulness.contradictoryCount} contradictory
          </p>
          <ClaimList claims={evaluation.faithfulness.claims} empty="No claims extracted." />
        </Scorecard>

        <Scorecard title="Hallucination" score={formatScore(evaluation.hallucination.rate)}>
          <p className="text-muted-foreground mb-1 text-[11px]">
            {evaluation.hallucination.detected ? 'Detected' : 'None detected'} (rate = share of
            unsupported/contradictory claims)
          </p>
          <ClaimList claims={evaluation.hallucination.claims} empty="No hallucinated claims." />
        </Scorecard>

        <Scorecard title="Context precision" score={formatScore(evaluation.precision.score)}>
          {evaluation.precision.citationScores.length === 0 ? (
            <p className="text-muted-foreground text-[11px] italic">No citations to score.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {evaluation.precision.citationScores.map((entry) => (
                <li
                  key={entry.index}
                  className="bg-muted/40 flex items-center justify-between gap-2 rounded-md border px-2 py-1 text-[11px]"
                >
                  <span className="font-mono">[{entry.index}]</span>
                  <span className="flex items-center gap-1.5">
                    <Badge variant={entry.relevant ? 'secondary' : 'outline'}>
                      {entry.relevant ? 'relevant' : 'irrelevant'}
                    </Badge>
                    <Badge variant="outline" className="font-mono">
                      {entry.method}
                    </Badge>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Scorecard>

        {evaluation.recall && (
          <Scorecard title="Context recall" score={formatScore(evaluation.recall.score)}>
            <ul className="flex flex-col gap-1">
              {evaluation.recall.groundTruthClaims.map((item) => (
                <li
                  key={item.claim}
                  className="bg-muted/40 rounded-md border px-2 py-1.5 text-[11px]"
                >
                  <Badge variant={item.covered ? 'secondary' : 'outline'} className="mb-0.5">
                    {item.covered ? 'covered' : 'missing'}
                  </Badge>
                  <span className="block leading-relaxed">{item.claim}</span>
                </li>
              ))}
            </ul>
          </Scorecard>
        )}

        {evaluation.correctness && (
          <Scorecard title="Answer correctness" score={formatScore(evaluation.correctness.score)}>
            <p className="text-muted-foreground text-[11px]">
              LLM-as-judge similarity to the reference answer (benchmark / GT turns).
            </p>
          </Scorecard>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
