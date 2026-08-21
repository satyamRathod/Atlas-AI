import { Router } from 'express';

import type { ChatController } from './chat.controller.js';

export function createChatRouter(controller: ChatController): Router {
  const router = Router();

  router.post('/', controller.handle);

  router.get('/stream', controller.stream.bind(controller));

  router.post('/graph/resume', controller.resumeGraph);

  router.get('/graph/resume/stream', controller.streamResumeGraph.bind(controller));

  return router;
}
