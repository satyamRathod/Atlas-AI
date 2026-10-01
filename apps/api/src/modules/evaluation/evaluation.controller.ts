import type { Request, RequestHandler, Response } from 'express';
import { z } from 'zod';

import { type BenchmarkRunner, listBenchmarkCases } from '@/langchain/evaluation/index.js';
import type { RedisEvaluationStore } from './infrastructure/redis-evaluation-store.js';

const runBenchmarkSchema = z.object({
  caseIds: z.array(z.string().trim().min(1)).optional(),
});

const runIdParamSchema = z.object({
  runId: z.string().trim().min(1, 'runId is required'),
});

/**
 * Phase 9 evaluation API — lists the built-in benchmark dataset, runs a
 * batch, and reads Redis-backed run history (§4 of
 * docs/phases/phase-9-evaluation.md).
 */
export class EvaluationController {
  constructor(
    private readonly benchmarkRunner: BenchmarkRunner,
    private readonly store: RedisEvaluationStore,
  ) {}

  public listBenchmarks: RequestHandler = (_req: Request, res: Response): void => {
    res.status(200).json({ cases: listBenchmarkCases() });
  };

  public runBenchmark: RequestHandler = async (req: Request, res: Response): Promise<void> => {
    const body = runBenchmarkSchema.parse(req.body ?? {});
    const summary = await this.benchmarkRunner.run(body.caseIds);
    res.status(200).json(summary);
  };

  public listRuns: RequestHandler = async (_req: Request, res: Response): Promise<void> => {
    const runs = await this.store.listRecentRuns();
    res.status(200).json({
      runs: runs.map((run) => ({
        runId: run.runId,
        createdAt: run.createdAt,
        caseCount: run.caseCount,
        aggregateScores: run.aggregateScores,
        durationMs: run.durationMs,
      })),
    });
  };

  public getRun: RequestHandler = async (req: Request, res: Response): Promise<void> => {
    const { runId } = runIdParamSchema.parse(req.params);
    const run = await this.store.getRun(runId);
    if (!run) {
      res.status(404).json({ message: `Evaluation run "${runId}" not found.` });
      return;
    }
    res.status(200).json(run);
  };
}
