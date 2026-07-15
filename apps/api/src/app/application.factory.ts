// import { EchoProvider } from "../ai/providers/echo-provider.js";

import OpenAI from 'openai';
import { OpenAIProvider } from '../ai/providers/openai-provider.js';
import { TokenBudgetManager } from '../ai/tokens/token-budget-manager.js';
import { env } from '../config/index.js';
import { createApp } from '../http/app.js';
import { createHttpServer } from '../http/server.js';
import { logger } from '../infrastructure/logger/index.js';
import { PromptBuilder } from '../modules/chat/application/prompt-builder.js';
import { ChatController } from '../modules/chat/chat.controller.js';
import { ChatService } from '../modules/chat/chat.service.js';
import { InMemoryConversationStore } from '../modules/chat/infrastructure/in-memory-conversation-store.js';
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

  const conversationStore = new InMemoryConversationStore();
  const tokenBudgetManager = new TokenBudgetManager({
    contextWindow: 8192,
    reservedOutputTokens: 1024,
  });
  const promptBuilder = new PromptBuilder(tokenBudgetManager);
  const chatService = new ChatService(llmProvider, conversationStore, promptBuilder);

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
