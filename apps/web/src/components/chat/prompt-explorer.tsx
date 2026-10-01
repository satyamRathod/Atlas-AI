import { useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ObservabilityTurn } from '@/types/chat';

interface PromptExplorerProps {
  turns: readonly ObservabilityTurn[];
  selectedTurnId?: string;
  onSelect: (turnId: string) => void;
  detail?: ObservabilityTurn;
}

/**
 * Prompt explorer — list recent turns, select one, inspect truncated
 * prompt variables + template metadata.
 */
export function PromptExplorer({ turns, selectedTurnId, onSelect, detail }: PromptExplorerProps) {
  const [localId, setLocalId] = useState(selectedTurnId);

  useEffect(() => {
    setLocalId(selectedTurnId);
  }, [selectedTurnId]);

  if (turns.length === 0) {
    return <p className="text-muted-foreground text-xs">No turns yet.</p>;
  }

  const active = detail ?? turns.find((t) => t.turnId === localId);

  return (
    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
      <ul className="border-border/60 max-h-72 overflow-y-auto rounded-md border">
        {turns.map((turn) => {
          const selected = turn.turnId === localId;
          return (
            <li key={turn.turnId}>
              <button
                type="button"
                onClick={() => {
                  setLocalId(turn.turnId);
                  onSelect(turn.turnId);
                }}
                className={cn(
                  'hover:bg-muted/50 flex w-full flex-col gap-0.5 border-b px-2.5 py-2 text-left text-xs last:border-b-0',
                  selected && 'bg-muted/60',
                )}
              >
                <span className="line-clamp-2 font-medium">{turn.question}</span>
                <span className="text-muted-foreground flex flex-wrap items-center gap-1.5 font-mono text-[10px]">
                  <Badge variant="outline" className="h-4 px-1 font-mono text-[10px]">
                    {turn.mode}
                  </Badge>
                  {turn.prompt.templateId}@v{turn.prompt.version}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="border-border/60 flex max-h-72 flex-col gap-2 overflow-y-auto rounded-md border p-3">
        {!active ? (
          <p className="text-muted-foreground text-xs">Select a turn to inspect its prompt.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <Badge variant="outline" className="font-mono">
                {active.prompt.templateName}
              </Badge>
              <span className="text-muted-foreground font-mono text-[11px]">
                {active.prompt.templateId} · v{active.prompt.version}
                {active.prompt.usedFewShot ? ' · few-shot' : ''}
              </span>
            </div>
            {(
              [
                ['question', active.prompt.variables.question],
                ['context', active.prompt.variables.context],
                ['summary', active.prompt.variables.summary],
                ['memory', active.prompt.variables.memory],
              ] as const
            ).map(([name, value]) => (
              <div key={name} className="flex flex-col gap-0.5">
                <span className="text-muted-foreground text-[10px] font-medium uppercase tracking-wide">
                  {name}
                </span>
                <pre className="bg-muted/40 max-h-24 overflow-auto rounded px-2 py-1.5 font-mono text-[11px] whitespace-pre-wrap">
                  {value || '—'}
                </pre>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
