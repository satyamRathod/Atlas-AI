import { Router } from 'express';

import type { EvaluationController } from './evaluation.controller.js';

export function createEvaluationRouter(controller: EvaluationController): Router {
  const router = Router();

  router.get('/benchmarks', controller.listBenchmarks);
  router.post('/benchmarks/run', controller.runBenchmark);
  router.get('/runs', controller.listRuns);
  router.get('/runs/:runId', controller.getRun);

  return router;
}
