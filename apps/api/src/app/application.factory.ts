// import { EchoProvider } from "../ai/providers/echo-provider.js";

import OpenAI from 'openai';
import { OpenAIProvider } from '../ai/providers/openai-provider.js';
import { env } from '../config/index.js';
import { createApp } from '../http/app.js';
import { createHttpServer } from '../http/server.js';
import { logger } from '../infrastructure/logger/index.js';
import { ChatController } from '../modules/chat/chat.controller.js';
import { ChatService } from '../modules/chat/chat.service.js';
import type { Application } from './application.js';

export function buildApplication(): Application {
  /*
   |--------------------------------------------------------------------------
   | Providers
   |--------------------------------------------------------------------------
   */

  const openAIClient = new OpenAI({
    apiKey: env.OPENAI_API_KEY,
    baseURL: env.OPENAI_BASE_URL,
  });

  const llmProvider = new OpenAIProvider({
    client: openAIClient,
    model: env.OPENAI_MODEL,
    logger,
  });

  /*
   |--------------------------------------------------------------------------
   | Services
   |--------------------------------------------------------------------------
   */

  const chatService = new ChatService(llmProvider);

  /*
   |--------------------------------------------------------------------------
   | Controllers
   |--------------------------------------------------------------------------
   */

  const chatController = new ChatController(chatService);

  /*
   |--------------------------------------------------------------------------
   | Express
   |--------------------------------------------------------------------------
   */

  const app = createApp({
    chatController,
  });

  /*
   |--------------------------------------------------------------------------
   | HTTP Server
   |--------------------------------------------------------------------------
   */

  const server = createHttpServer(app);

  return {
    app,
    server,
  };
}
