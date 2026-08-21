import { Router } from 'express';

import type { GraphController } from './graph.controller.js';

export function createGraphRouter(controller: GraphController): Router {
  const router = Router();

  router.get('/', controller.definition);

  router.get('/state/:sessionId', controller.state);

  return router;
}
