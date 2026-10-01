import { randomUUID } from 'node:crypto';

import { resolveBenchmarkCases } from './benchmark-dataset.js';
import { clamp01, mean } from './claim-heuristics.js';
import type {
  BenchmarkCaseResult,
  BenchmarkRunSummary,
  EvaluationRunInfo,
  MetricScore,
} from './evaluation.types.js';
import type { TurnEvaluator } from './evaluators.js';

/** Minimal chat surface the benchmark runner needs — avoids a circular import with ChatService. */
export interface BenchmarkChatClient {
  answerForBenchmark(
    question: string,
    sessionId: string,
  ): Promise<{
    reply: string;
    context: string;
    citations: readonly { index: number; snippet: string; content: string }[];
  }>;
}

export interface BenchmarkRunStore {
  saveRun(summary: BenchmarkRunSummary): Promise<void>;
}

/**
 * Runs the built-in benchmark dataset through normal RAG chat (no tools /
 * agent / graph / multi-agent) then scores each case with `TurnEvaluator`
 * using the case's `expectedAnswer` as both ground truth (recall) and
 * reference (correctness).
 */
export class BenchmarkRunner {
  constructor(
    private readonly chat: BenchmarkChatClient,
    private readonly evaluator: TurnEvaluator,
    private readonly store: BenchmarkRunStore,
  ) {}

  public async run(caseIds?: readonly string[]): Promise<BenchmarkRunSummary> {
    const cases = resolveBenchmarkCases(caseIds);
    if (cases.length === 0) {
      throw new Error('No matching benchmark cases for the requested caseIds.');
    }

    const runId = randomUUID();
    const startedAt = Date.now();
    const results: BenchmarkCaseResult[] = [];

    for (const benchmarkCase of cases) {
      const sessionId = `eval:${runId}:${benchmarkCase.id}`;
      const answer = await this.chat.answerForBenchmark(benchmarkCase.question, sessionId);
      const evaluation = await this.evaluator.evaluateTurn({
        question: benchmarkCase.question,
        reply: answer.reply,
        context: answer.context,
        citations: answer.citations,
        groundTruth: benchmarkCase.expectedAnswer,
        expectedAnswer: benchmarkCase.expectedAnswer,
        mode: 'benchmark',
      });

      results.push({
        caseId: benchmarkCase.id,
        question: benchmarkCase.question,
        reply: answer.reply,
        citationCount: answer.citations.length,
        evaluation,
      });
    }

    const summary: BenchmarkRunSummary = {
      runId,
      createdAt: new Date().toISOString(),
      caseCount: results.length,
      aggregateScores: aggregateScores(results.map((result) => result.evaluation)),
      cases: results,
      durationMs: Date.now() - startedAt,
    };

    await this.store.saveRun(summary);
    return summary;
  }
}

function aggregateScores(runs: readonly EvaluationRunInfo[]): MetricScore[] {
  const buckets = new Map<MetricScore['name'], number[]>();

  for (const run of runs) {
    for (const score of run.scores) {
      const list = buckets.get(score.name) ?? [];
      list.push(score.score);
      buckets.set(score.name, list);
    }
  }

  return [...buckets.entries()].map(([name, values]) => ({
    name,
    score: clamp01(mean(values)),
  }));
}
