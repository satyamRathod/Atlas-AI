import { AlertTriangle, Play } from 'lucide-react';
import { useEffect, useState } from 'react';

import { BenchmarkComparisonView } from '@/components/chat/benchmark-comparison-view';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getEvaluationRun, listBenchmarkCases, listEvaluationRuns, runBenchmark } from '@/lib/api';
import type { BenchmarkCase, BenchmarkRunListItem, BenchmarkRunSummary } from '@/types/chat';

interface BenchmarkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Benchmark dialog (Phase 9 UI) — run the built-in dataset, pick two past
 * runs to compare, and show aggregate dashboards. Isolated from the live
 * chat stream the same way Prompt Comparison is.
 */
export function BenchmarkDialog({ open, onOpenChange }: BenchmarkDialogProps) {
  const [cases, setCases] = useState<readonly BenchmarkCase[]>([]);
  const [runs, setRuns] = useState<readonly BenchmarkRunListItem[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [latest, setLatest] = useState<BenchmarkRunSummary | undefined>();
  const [runAId, setRunAId] = useState<string>('');
  const [runBId, setRunBId] = useState<string>('');
  const [runA, setRunA] = useState<BenchmarkRunSummary | undefined>();
  const [runB, setRunB] = useState<BenchmarkRunSummary | undefined>();

  useEffect(() => {
    if (!open) return;
    listBenchmarkCases()
      .then(setCases)
      .catch(() => setCases([]));
    listEvaluationRuns()
      .then(setRuns)
      .catch(() => setRuns([]));
  }, [open]);

  useEffect(() => {
    if (!runAId) {
      setRunA(undefined);
      return;
    }
    getEvaluationRun(runAId)
      .then(setRunA)
      .catch(() => setRunA(undefined));
  }, [runAId]);

  useEffect(() => {
    if (!runBId) {
      setRunB(undefined);
      return;
    }
    getEvaluationRun(runBId)
      .then(setRunB)
      .catch(() => setRunB(undefined));
  }, [runBId]);

  const handleRun = async () => {
    if (running) return;
    setRunning(true);
    setError(undefined);
    try {
      // Small subset by default to limit Groq TPM during demos.
      const subset = cases.slice(0, 2).map((item) => item.id);
      const summary = await runBenchmark(subset.length > 0 ? subset : undefined);
      setLatest(summary);
      setRunAId(summary.runId);
      const refreshed = await listEvaluationRuns();
      setRuns(refreshed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Benchmark run failed.');
    } finally {
      setRunning(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-4 overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Benchmarks</DialogTitle>
          <DialogDescription>
            Run the built-in RAG evaluation dataset (normal chat mode only), then compare aggregate
            scores across runs.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="font-mono">
            {cases.length} cases
          </Badge>
          <Button onClick={handleRun} disabled={running} className="gap-1.5">
            <Play className="size-3.5" />
            {running ? 'Running…' : 'Run sample (2 cases)'}
          </Button>
        </div>

        {error && (
          <p className="text-destructive flex items-center gap-1.5 text-xs">
            <AlertTriangle className="size-3.5 shrink-0" />
            {error}
          </p>
        )}

        {latest && (
          <div className="flex flex-col gap-1.5 rounded-md border p-2.5 text-xs">
            <span className="font-medium">Latest run · {latest.caseCount} cases</span>
            <div className="flex flex-wrap gap-1.5">
              {latest.aggregateScores.map((score) => (
                <Badge key={score.name} variant="secondary" className="font-mono capitalize">
                  {score.name} {Math.round(score.score * 100)}%
                </Badge>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <span className="text-muted-foreground text-xs font-medium">Run A</span>
            <Select value={runAId} onValueChange={setRunAId}>
              <SelectTrigger size="sm">
                <SelectValue placeholder="Select a run" />
              </SelectTrigger>
              <SelectContent>
                {runs.map((run) => (
                  <SelectItem key={run.runId} value={run.runId}>
                    {new Date(run.createdAt).toLocaleString()} · {run.caseCount} cases
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-muted-foreground text-xs font-medium">Run B</span>
            <Select value={runBId} onValueChange={setRunBId}>
              <SelectTrigger size="sm">
                <SelectValue placeholder="Select a run" />
              </SelectTrigger>
              <SelectContent>
                {runs.map((run) => (
                  <SelectItem key={run.runId} value={run.runId}>
                    {new Date(run.createdAt).toLocaleString()} · {run.caseCount} cases
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <BenchmarkComparisonView runA={runA} runB={runB} />
      </DialogContent>
    </Dialog>
  );
}
