import { Badge } from '@/components/ui/badge';
import type { ObservabilityTurn } from '@/types/chat';

interface RequestInspectorProps {
  turn?: ObservabilityTurn;
}

function formatCost(usd: number | undefined): string {
  if (usd === undefined) return '—';
  if (usd === 0) return '$0';
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(3)}`;
}

/**
 * Request inspector — stages timeline, usage, cost, flags, retrieval for
 * one ObservabilityTurn.
 */
export function RequestInspector({ turn }: RequestInspectorProps) {
  if (!turn) {
    return (
      <p className="text-muted-foreground text-xs">
        Select a turn from Prompts (or the list below) to inspect the full request.
      </p>
    );
  }

  const maxStage = Math.max(1, ...turn.latency.stages.map((s) => s.durationMs));

  return (
    <div className="flex flex-col gap-4 text-xs">
      <div className="flex flex-wrap gap-1.5">
        <Badge variant="outline" className="font-mono">
          {turn.mode}
        </Badge>
        <Badge variant="outline" className="font-mono">
          {turn.model}
        </Badge>
        {turn.flags.interrupted && (
          <Badge variant="destructive" className="font-mono">
            interrupted
          </Badge>
        )}
        {turn.error && (
          <Badge variant="destructive" className="font-mono">
            error
          </Badge>
        )}
      </div>

      <MetaRow label="turnId" value={turn.turnId} />
      {turn.requestId && <MetaRow label="requestId" value={turn.requestId} />}
      <MetaRow label="sessionId" value={turn.sessionId} />
      <MetaRow label="createdAt" value={turn.createdAt} />
      <MetaRow label="question" value={turn.question} />
      <MetaRow label="replyPreview" value={turn.replyPreview} />

      <section className="flex flex-col gap-1.5">
        <span className="text-muted-foreground font-medium">Latency stages</span>
        {turn.latency.stages.map((stage) => {
          const pct = Math.round((stage.durationMs / maxStage) * 100);
          return (
            <div key={stage.name} className="flex items-center gap-2">
              <span className="w-36 shrink-0 truncate font-mono text-[11px]">{stage.name}</span>
              <div className="bg-muted h-2 flex-1 overflow-hidden rounded-sm">
                <div className="bg-primary/70 h-full rounded-sm" style={{ width: `${pct}%` }} />
              </div>
              <span className="w-14 shrink-0 text-right font-mono tabular-nums">
                {stage.durationMs}ms
              </span>
            </div>
          );
        })}
        {turn.latency.firstTokenMs !== undefined && (
          <p className="text-muted-foreground font-mono text-[11px]">
            firstTokenMs: {turn.latency.firstTokenMs}
          </p>
        )}
      </section>

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="input tok" value={turn.usage?.input_tokens?.toLocaleString() ?? '—'} />
        <Stat label="output tok" value={turn.usage?.output_tokens?.toLocaleString() ?? '—'} />
        <Stat label="total tok" value={turn.usage?.total_tokens?.toLocaleString() ?? '—'} />
        <Stat label="est. cost" value={formatCost(turn.costUsd)} />
      </section>

      <section className="flex flex-col gap-1">
        <span className="text-muted-foreground font-medium">
          Retrieval · {turn.retrieval.strategy}
        </span>
        {turn.retrieval.stages.length === 0 ? (
          <span className="text-muted-foreground">No retrieval stages</span>
        ) : (
          turn.retrieval.stages.map((stage) => (
            <span key={stage.name} className="font-mono text-[11px]">
              {stage.name}: {stage.durationMs}ms
            </span>
          ))
        )}
      </section>

      <section className="flex flex-col gap-1">
        <span className="text-muted-foreground font-medium">Flags</span>
        <pre className="bg-muted/40 overflow-auto rounded px-2 py-1.5 font-mono text-[11px]">
          {JSON.stringify(turn.flags, null, 2)}
        </pre>
      </section>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
      <span className="text-muted-foreground w-24 shrink-0 font-medium">{label}</span>
      <span className="break-all font-mono text-[11px]">{value}</span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-border/60 bg-muted/30 flex flex-col gap-0.5 rounded-md border px-2.5 py-2">
      <span className="text-muted-foreground text-[10px] uppercase tracking-wide">{label}</span>
      <span className="font-mono tabular-nums">{value}</span>
    </div>
  );
}
