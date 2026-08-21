import { AlertTriangle, Check, X } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { PendingApprovalInfo } from '@/types/chat';

interface HumanApprovalPanelProps {
  pendingApproval?: PendingApprovalInfo;
  onDecision: (approved: boolean, feedback?: string) => void;
  /** Disables both buttons while the resumed run is in flight, so a double-click can't send two resume requests for the same paused thread. */
  disabled?: boolean;
}

/**
 * Human approval panel (Phase 7 UI) — shown whenever `message.pendingApproval`
 * is set, i.e. the `human_approval` node's `interrupt()` has paused this
 * turn (§1 of docs/phases/phase-7-langgraph.md). Unlike every other panel
 * in this file (which are read-only reconciliations of a finished turn),
 * this one is the turn's *only* path forward — nothing else can make the
 * conversation progress until Approve/Reject calls `approveGraphRun()`.
 */
export function HumanApprovalPanel({
  pendingApproval,
  onDecision,
  disabled,
}: HumanApprovalPanelProps) {
  const [feedback, setFeedback] = useState('');

  if (!pendingApproval) return null;

  return (
    <div className="border-amber-500/40 bg-amber-500/10 flex w-full flex-col gap-3 rounded-lg border p-3">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-amber-800 dark:text-amber-400">
            Approval required
          </span>
          <p className="text-muted-foreground text-xs leading-relaxed">{pendingApproval.reason}</p>
        </div>
      </div>

      <ul className="flex flex-col gap-1.5">
        {pendingApproval.toolCalls.map((call) => (
          <li
            key={call.id}
            className="bg-background/60 flex flex-col gap-1 rounded-md border px-2.5 py-1.5 text-xs"
          >
            <Badge variant="outline" className="w-fit font-mono">
              {call.name}
            </Badge>
            <pre className="text-muted-foreground overflow-auto text-[11px] whitespace-pre-wrap">
              {JSON.stringify(call.args, null, 2)}
            </pre>
          </li>
        ))}
      </ul>

      <Textarea
        value={feedback}
        onChange={(event) => setFeedback(event.target.value)}
        placeholder="Optional feedback for the model (shown to it if you reject)…"
        className="min-h-16 text-xs"
        disabled={disabled}
      />

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
          onClick={() => onDecision(true, feedback.trim() || undefined)}
          disabled={disabled}
        >
          <Check className="size-3.5" />
          Approve
        </Button>
        <Button
          size="sm"
          variant="destructive"
          className="gap-1.5"
          onClick={() => onDecision(false, feedback.trim() || undefined)}
          disabled={disabled}
        >
          <X className="size-3.5" />
          Reject
        </Button>
      </div>
    </div>
  );
}
