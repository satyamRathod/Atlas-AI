import compression from 'compression';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { httpLogger } from '../infrastructure/logger/index.js';
import type { ChatController } from '../modules/chat/chat.controller.js';
import { createChatRouter } from '../modules/chat/chat.route.js';
import healthRouter from '../modules/health/health.route.js';
import { errorHandler } from './middleware/error-handler.js';
import { notFoundHandler } from './middleware/not-found.js';

interface AppDependencies {
  chatController: ChatController;
}

export function createApp({ chatController }: AppDependencies): Express {
  const app: Express = express();

  app.disable('x-powered-by');

  // Logging first
  app.use(httpLogger);

  app.use(helmet());
  app.use(cors());
  app.use(compression());

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Routes
  app.use('/health', healthRouter);
  app.use('/api/v1/chat', createChatRouter(chatController));

  // Error handling
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
