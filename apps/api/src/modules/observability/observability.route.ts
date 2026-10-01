import { Router } from 'express';

import type { ObservabilityController } from './observability.controller.js';

export function createObservabilityRouter(controller: ObservabilityController): Router {
  const router = Router();

  router.get('/turns', controller.listTurns);
  router.get('/turns/:turnId', controller.getTurn);
  router.get('/metrics', controller.metrics);

  return router;
}
