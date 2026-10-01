import { env } from '@/config/env.js';
import { createRedisClient } from '@/infrastructure/redis/index.js';
import { ReactAgentRunner } from '@/langchain/agents/index.js';
import { createChatModel } from '@/langchain/chat/index.js';
import { createEmbeddings } from '@/langchain/embeddings/index.js';
import {
  buildAgentGraph,
  createGraphCheckpointer,
  GraphAgentRunner,
} from '@/langchain/graph/index.js';
import { createSemanticMemoryStore, SemanticMemoryStore } from '@/langchain/memory/index.js';
import {
  buildMultiAgentGraph,
  createMultiAgentCheckpointer,
  MultiAgentRunner,
} from '@/langchain/multi-agent/index.js';
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
import { createToolRegistry, ToolExecutor } from '@/langchain/tools/index.js';
import { createQdrantVectorStore } from '@/langchain/vectorstores/index.js';

import { createApp } from '../http/app.js';
import { createHttpServer } from '../http/server.js';
import { ChatController } from '../modules/chat/chat.controller.js';
import { ChatService } from '../modules/chat/chat.service.js';
import { RedisChatMemoryStore } from '../modules/chat/infrastructure/redis-chat-memory-store.js';
import { GraphController } from '../modules/graph/graph.controller.js';
import { MultiAgentController } from '../modules/multi-agent/multi-agent.controller.js';
import { RedisPromptStore } from '../modules/prompts/infrastructure/redis-prompt-store.js';
import { PromptController } from '../modules/prompts/prompt.controller.js';
import { PromptService } from '../modules/prompts/prompt.service.js';
import { ToolsController } from '../modules/tools/tools.controller.js';
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
   | Phase 3 — Memory
   |--------------------------------------------------------------------------
   | Conversation history/summaries persist to the same Redis instance
   | Phase 2 uses for BM25/parent-document (§2, §5). Semantic memory (§7) is
   | off by default (MEMORY_SEMANTIC_ENABLED) since it adds an LLM call per
   | turn — see docs/phases/phase-3-memory.md.
   */

  const redisClient = createRedisClient();
  const historyStore = new RedisChatMemoryStore(redisClient);

  const semanticMemoryStore = env.MEMORY_SEMANTIC_ENABLED
    ? new SemanticMemoryStore(await createSemanticMemoryStore({ embeddings }))
    : undefined;

  /*
   |--------------------------------------------------------------------------
   | Phase 4 — Prompt Engineering
   |--------------------------------------------------------------------------
   | Versioned prompt-template registry, same Redis instance as Phase 3.
   | Seeding is idempotent (checks before creating), so it's safe to run on
   | every boot — see docs/phases/phase-4-prompt-engineering.md §2.
   */

  const promptStore = new RedisPromptStore(redisClient);
  const promptService = new PromptService(promptStore);
  await promptService.seedBuiltInTemplatesIfMissing();

  /*
   |--------------------------------------------------------------------------
   | Phase 5 — Tools
   |--------------------------------------------------------------------------
   | All five tools are registered up front — same "build everything at
   | boot, branch per-request" shape as the Phase 2 retrieval pipeline.
   | file_search reuses the retrievalPipeline built above instead of
   | standing up a second retrieval path — see docs/phases/phase-5-tools.md.
   */

  const toolRegistry = createToolRegistry({ retrievalPipeline });
  const toolExecutor = new ToolExecutor(toolRegistry, env.TOOLS_EXECUTION_TIMEOUT_MS);

  /*
   |--------------------------------------------------------------------------
   | Phase 6 — Agents
   |--------------------------------------------------------------------------
   | Reuses the same `toolExecutor` Phase 5 built above — the ReAct loop
   | executes tools identically, only the model's *decision* mechanism
   | (text parsing vs. native bindTools) differs. See
   | docs/phases/phase-6-agents.md.
   */

  const reactAgentRunner = new ReactAgentRunner(chatModel, toolExecutor, {
    maxSteps: env.AGENT_MAX_STEPS,
    planMaxSteps: env.AGENT_PLAN_MAX_STEPS,
  });

  /*
   |--------------------------------------------------------------------------
   | Phase 7 — LangGraph
   |--------------------------------------------------------------------------
   | Same `toolExecutor` as Phase 5/6 once again — only the orchestration
   | (explicit state, conditional routing, checkpoints, interrupts) is new.
   | The checkpointer points at the same Redis instance every prior phase
   | already reuses. See docs/phases/phase-7-langgraph.md.
   */

  const graphCheckpointer = await createGraphCheckpointer();
  const compiledAgentGraph = buildAgentGraph({
    chatModel,
    toolExecutor,
    checkpointer: graphCheckpointer,
    approvalToolNames: env.AGENT_GRAPH_APPROVAL_TOOLS,
    maxSteps: env.AGENT_GRAPH_MAX_STEPS,
  });
  const graphAgentRunner = new GraphAgentRunner(compiledAgentGraph);

  /*
   |--------------------------------------------------------------------------
   | Phase 8 — Multi-Agent
   |--------------------------------------------------------------------------
   | Same `toolExecutor` as Phase 5/6/7 once more — only the researcher
   | specialist calls tools. Its own Redis-backed checkpointer (own TTL,
   | own `magent:{sessionId}` thread namespace) keeps it fully separate from
   | Phase 7's graph checkpoints. See docs/phases/phase-8-multi-agent.md.
   */

  const multiAgentCheckpointer = await createMultiAgentCheckpointer();
  const compiledMultiAgentGraph = buildMultiAgentGraph({
    chatModel,
    toolExecutor,
    checkpointer: multiAgentCheckpointer,
    maxRounds: env.MULTI_AGENT_MAX_ROUNDS,
    researcherMaxToolCalls: env.MULTI_AGENT_RESEARCHER_MAX_TOOL_CALLS,
  });
  const multiAgentRunner = new MultiAgentRunner(compiledMultiAgentGraph);

  /*
   |--------------------------------------------------------------------------
   | Services
   |--------------------------------------------------------------------------
   */

  const chatService = new ChatService(
    chatModel,
    retrievalPipeline,
    historyStore,
    promptService,
    toolExecutor,
    reactAgentRunner,
    graphAgentRunner,
    multiAgentRunner,
    semanticMemoryStore,
  );

  /*
   |--------------------------------------------------------------------------
   | Controllers
   |--------------------------------------------------------------------------
   */

  const chatController = new ChatController(chatService);
  const promptController = new PromptController(promptService);
  const toolsController = new ToolsController(toolExecutor);
  const graphController = new GraphController(compiledAgentGraph);
  const multiAgentController = new MultiAgentController(compiledMultiAgentGraph);

  /*
   |--------------------------------------------------------------------------
   | Express
   |--------------------------------------------------------------------------
   */

  const app = createApp({
    chatController,
    promptController,
    toolsController,
    graphController,
    multiAgentController,
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
