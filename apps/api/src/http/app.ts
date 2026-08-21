import compression from 'compression';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { httpLogger } from '../infrastructure/logger/index.js';
import type { ChatController } from '../modules/chat/chat.controller.js';
import { createChatRouter } from '../modules/chat/index.js';
import type { GraphController } from '../modules/graph/graph.controller.js';
import { createGraphRouter } from '../modules/graph/graph.route.js';
import healthRouter from '../modules/health/health.route.js';
import type { PromptController } from '../modules/prompts/prompt.controller.js';
import { createPromptRouter } from '../modules/prompts/prompt.route.js';
import type { ToolsController } from '../modules/tools/tools.controller.js';
import { createToolsRouter } from '../modules/tools/tools.route.js';
import { errorHandler } from './middleware/error-handler.js';
import { notFoundHandler } from './middleware/not-found.js';

interface AppDependencies {
  chatController: ChatController;
  promptController: PromptController;
  toolsController: ToolsController;
  graphController: GraphController;
}

export function createApp({
  chatController,
  promptController,
  toolsController,
  graphController,
}: AppDependencies): Express {
  const app: Express = express();

  app.disable('x-powered-by');

  // Logging first
  app.use(httpLogger);

  app.use(helmet());
  app.use(cors());
  app.use(
    compression({
      filter: (req, res) => {
        if (req.headers.accept === 'text/event-stream') {
          return false;
        }

        return compression.filter(req, res);
      },
    }),
  );

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Routes
  app.use('/health', healthRouter);
  app.use('/api/v1/chat', createChatRouter(chatController));
  app.use('/api/v1/prompts', createPromptRouter(promptController));
  app.use('/api/v1/tools', createToolsRouter(toolsController));
  app.use('/api/v1/graph', createGraphRouter(graphController));

  // Error handling
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
