import { Database, Layers, Search } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { type GraphCheckpointSummary, getGraphStateHistory } from '@/lib/api';
import type { GraphNodeDisplay, PendingApprovalInfo } from '@/types/chat';

interface GraphStateInspectorProps {
  sessionId: string;
  nodes?: readonly GraphNodeDisplay[];
  pendingApproval?: PendingApprovalInfo;
}

function formatTimestamp(iso?: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleTimeString();
  } catch {
    return iso;
  }
}

/** One row of the Redis-backed checkpoint history — every super-step LangGraph committed for this thread (§0.1/§1 of docs/phases/phase-7-langgraph.md), oldest first. */
function CheckpointRow({
  checkpoint,
  index,
}: {
  checkpoint: GraphCheckpointSummary;
  index: number;
}) {
  return (
    <li className="bg-muted/50 flex flex-col gap-1 rounded-md border p-2.5 text-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5 font-medium">
          <Badge variant="outline" className="font-mono">
            #{index}
          </Badge>
          <span className="truncate font-mono">{checkpoint.checkpointId ?? 'unknown'}</span>
        </span>
        <span className="text-muted-foreground shrink-0 font-mono">
          {formatTimestamp(checkpoint.createdAt)}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="secondary" className="font-mono">
          step {checkpoint.stepCount}
        </Badge>
        <Badge variant="secondary" className="font-mono">
          {checkpoint.messageCount} msgs
        </Badge>
        {checkpoint.hasPendingApproval && <Badge variant="outline">Awaiting approval</Badge>}
        {checkpoint.next.length > 0 && (
          <span className="text-muted-foreground font-mono">
            next: {checkpoint.next.join(', ')}
          </span>
        )}
      </div>
    </li>
  );
}

/**
 * Graph state inspector (Phase 7 UI) — a dialog combining this turn's live
 * state (step count, the tool-call log, any pending approval) with the
 * thread's full checkpoint history pulled from Redis via
 * `GET /api/v1/graph/state/:sessionId` (`GraphController.state`), so you
 * can see not just what happened but that it's durably checkpointed —
 * the whole point of swapping the Phase 6 ReAct scratchpad for a
 * LangGraph-managed state graph.
 */
export function GraphStateInspector({
  sessionId,
  nodes,
  pendingApproval,
}: GraphStateInspectorProps) {
  const [open, setOpen] = useState(false);
  const [checkpoints, setCheckpoints] = useState<readonly GraphCheckpointSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setLoadError(false);
    getGraphStateHistory(sessionId)
      .then(setCheckpoints)
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, [open, sessionId]);

  if (!nodes || nodes.length === 0) return null;

  const stepCount = nodes.length;
  const orderedCheckpoints = [...checkpoints].reverse();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant="outline"
        size="sm"
        className="h-7 gap-1.5 text-xs"
        onClick={() => setOpen(true)}
      >
        <Search className="size-3.5" />
        Inspect state
      </Button>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="size-4 shrink-0" />
            Graph state
          </DialogTitle>
          <DialogDescription className="font-mono">{sessionId}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary" className="font-mono">
              {stepCount} node {stepCount === 1 ? 'step' : 'steps'} this turn
            </Badge>
            {pendingApproval && <Badge variant="outline">Awaiting approval</Badge>}
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
              <Database className="size-3.5" />
              Checkpoint history (Redis, thread = sessionId)
            </span>
            {loading && <p className="text-muted-foreground text-xs">Loading checkpoints…</p>}
            {loadError && (
              <p className="text-destructive text-xs">Could not load checkpoint history.</p>
            )}
            {!loading && !loadError && orderedCheckpoints.length === 0 && (
              <p className="text-muted-foreground text-xs">No checkpoints found for this thread.</p>
            )}
            {!loading && !loadError && orderedCheckpoints.length > 0 && (
              <ScrollArea className="h-64">
                <ul className="flex flex-col gap-1.5 pr-3">
                  {orderedCheckpoints.map((checkpoint, index) => (
                    <CheckpointRow
                      key={checkpoint.checkpointId ?? index}
                      checkpoint={checkpoint}
                      index={index}
                    />
                  ))}
                </ul>
              </ScrollArea>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
