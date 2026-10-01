import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { ObservabilityDashboard } from '@/components/chat/observability-dashboard';
import { PromptExplorer } from '@/components/chat/prompt-explorer';
import { RequestInspector } from '@/components/chat/request-inspector';
import { TokenCostCharts } from '@/components/chat/token-cost-charts';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { getObservabilityMetrics, getObservabilityTurn, listObservabilityTurns } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { ObservabilityMetrics, ObservabilityTurn } from '@/types/chat';

type ObsTab = 'overview' | 'tokens' | 'prompts' | 'inspector';

interface ObservabilityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Observability dialog (Phase 10 UI) — monitoring dashboard, token/cost
 * charts, prompt explorer, and request inspector. Same header-dialog
 * pattern as Benchmarks.
 */
export function ObservabilityDialog({ open, onOpenChange }: ObservabilityDialogProps) {
  const [tab, setTab] = useState<ObsTab>('overview');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [metrics, setMetrics] = useState<ObservabilityMetrics | undefined>();
  const [turns, setTurns] = useState<readonly ObservabilityTurn[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [detail, setDetail] = useState<ObservabilityTurn | undefined>();

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const [nextMetrics, nextTurns] = await Promise.all([
        getObservabilityMetrics(200),
        listObservabilityTurns({ limit: 50 }),
      ]);
      setMetrics(nextMetrics);
      setTurns(nextTurns);
      setSelectedId((prev) => {
        if (prev && nextTurns.some((t) => t.turnId === prev)) return prev;
        return nextTurns[0]?.turnId ?? '';
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load observability data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void refresh();
  }, [open, refresh]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(undefined);
      return;
    }
    let cancelled = false;
    getObservabilityTurn(selectedId)
      .then((turn) => {
        if (!cancelled) setDetail(turn);
      })
      .catch(() => {
        if (!cancelled) setDetail(undefined);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const tabs: { id: ObsTab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'tokens', label: 'Tokens & cost' },
    { id: 'prompts', label: 'Prompts' },
    { id: 'inspector', label: 'Inspector' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-4 overflow-hidden sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Observability</DialogTitle>
          <DialogDescription>
            Per-turn traces from Redis — latency, tokens, estimated cost, prompts, and retrieval
            stages. Estimates use configured $/1K rates, not live billing.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <div className="bg-muted/40 flex gap-0.5 rounded-md p-0.5">
            {tabs.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={cn(
                  'rounded px-2.5 py-1 text-xs font-medium transition-colors',
                  tab === item.id
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void refresh()}
            disabled={loading}
            className="ml-auto gap-1.5"
          >
            <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} />
            Refresh
          </Button>
        </div>

        {error && (
          <p className="text-destructive flex items-center gap-1.5 text-xs">
            <AlertTriangle className="size-3.5 shrink-0" />
            {error}
          </p>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {tab === 'overview' && <ObservabilityDashboard metrics={metrics} loading={loading} />}
          {tab === 'tokens' && <TokenCostCharts turns={turns} />}
          {tab === 'prompts' && (
            <PromptExplorer
              turns={turns}
              selectedTurnId={selectedId}
              onSelect={setSelectedId}
              detail={detail}
            />
          )}
          {tab === 'inspector' && (
            <div className="flex flex-col gap-3">
              {turns.length > 0 && (
                <label className="flex flex-col gap-1 text-xs">
                  <span className="text-muted-foreground font-medium">Turn</span>
                  <select
                    className="border-input bg-background rounded-md border px-2 py-1.5 font-mono text-xs"
                    value={selectedId}
                    onChange={(e) => setSelectedId(e.target.value)}
                  >
                    {turns.map((turn) => (
                      <option key={turn.turnId} value={turn.turnId}>
                        {turn.mode} · {turn.question.slice(0, 48)}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <RequestInspector turn={detail} />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
