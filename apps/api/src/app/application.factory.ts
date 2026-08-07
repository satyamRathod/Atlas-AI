import { createChatModel } from '@/langchain/chat/index.js';
import { createEmbeddings } from '@/langchain/embeddings/index.js';
import { createRetriever } from '@/langchain/retrievers/index.js';
import { createQdrantVectorStore } from '@/langchain/vectorstores/index.js';

import { createApp } from '../http/app.js';
import { createHttpServer } from '../http/server.js';
import { ChatController } from '../modules/chat/chat.controller.js';
import { ChatService } from '../modules/chat/chat.service.js';
import { InMemoryChatHistoryStore } from '../modules/chat/infrastructure/in-memory-chat-history-store.js';
import type { Application } from './application.js';

export async function buildApplication(): Promise<Application> {
  /*
   |--------------------------------------------------------------------------
   | LangChain primitives
   |--------------------------------------------------------------------------
   */

  const chatModel = createChatModel();
  const embeddings = createEmbeddings();
  const vectorStore = await createQdrantVectorStore({ embeddings });
  const retriever = createRetriever(vectorStore);

  /*
   |--------------------------------------------------------------------------
   | Services
   |--------------------------------------------------------------------------
   */

  const historyStore = new InMemoryChatHistoryStore();
  const chatService = new ChatService(chatModel, retriever, historyStore);

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
