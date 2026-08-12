import { Router } from 'express';

import type { PromptController } from './prompt.controller.js';

export function createPromptRouter(controller: PromptController): Router {
  const router = Router();

  router.get('/', controller.list);
  router.post('/', controller.create);
  router.get('/:id', controller.get);
  router.post('/:id/versions', controller.addVersion);

  return router;
}
