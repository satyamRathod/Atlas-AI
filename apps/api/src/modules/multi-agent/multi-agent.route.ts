import { Router } from 'express';

import type { MultiAgentController } from './multi-agent.controller.js';

export function createMultiAgentRouter(controller: MultiAgentController): Router {
  const router = Router();

  router.get('/', controller.definition);

  router.get('/state/:threadId', controller.state);

  return router;
}
