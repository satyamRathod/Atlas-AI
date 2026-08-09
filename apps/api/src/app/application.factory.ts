import { createChatModel } from '@/langchain/chat/index.js';
import { createEmbeddings } from '@/langchain/embeddings/index.js';
import { createAdvancedRetriever } from '@/langchain/retrieval/index.js';
import {
  connectParentDocumentRetriever,
  createBm25Retriever,
  createHybridRetriever,
  createMmrRetriever,
  createMultiQueryRetriever,
  createRetriever,
  createSelfQueryRetriever,
  toParentDocumentRetriever,
} from '@/langchain/retrievers/index.js';
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

  /*
   |--------------------------------------------------------------------------
   | Phase 2 — Advanced RAG retrieval pipeline
   |--------------------------------------------------------------------------
   | Every strategy is built up front (not lazily per-request) so the chat
   | API's `retrievalStrategy` override always has a ready retriever behind
   | it. See docs/phases/phase-2-advanced-rag.md for the full pipeline.
   |
   | All of this only ever *connects to* indexes that already exist — every
   | ingestion strategy (dense, BM25, parent-document) is built exclusively
   | by the `knowledge:index` CLI command, never here at boot. If an index
   | hasn't been built yet, these calls throw a clear error telling you
   | which `knowledge:index` command to run.
   */

  const denseRetriever = createRetriever(vectorStore);
  const bm25Retriever = await createBm25Retriever();
  const hybridRetriever = createHybridRetriever({ vectorStore, bm25Retriever });
  const mmrRetriever = createMmrRetriever({ vectorStore });
  const multiQueryRetriever = createMultiQueryRetriever({
    baseRetriever: hybridRetriever,
    llm: chatModel,
  });
  const selfQueryRetriever = createSelfQueryRetriever({ vectorStore, llm: chatModel });
  const parentDocumentRetriever = toParentDocumentRetriever(
    await connectParentDocumentRetriever({ embeddings }),
  );

  const retrievalPipeline = createAdvancedRetriever({
    denseRetriever,
    hybridRetriever,
    mmrRetriever,
    multiQueryRetriever,
    selfQueryRetriever,
    parentDocumentRetriever,
    chatModel,
    embeddings,
  });

  /*
   |--------------------------------------------------------------------------
   | Services
   |--------------------------------------------------------------------------
   */

  const historyStore = new InMemoryChatHistoryStore();
  const chatService = new ChatService(chatModel, retrievalPipeline, historyStore);

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
