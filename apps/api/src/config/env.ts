import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

import { PATHS } from './paths.js';

//load environment variables from .env file into process.env
loadEnv();

/**
 * `z.coerce.boolean()` is a footgun for env vars: `Boolean("false")` is
 * `true` in JS, so any non-empty string coerces to `true`. This helper
 * only accepts the literal strings "true"/"false".
 */
function booleanFlag(defaultValue: boolean) {
  return z
    .enum(['true', 'false'])
    .default(defaultValue ? 'true' : 'false')
    .transform((value) => value === 'true');
}

//define environment variables schema
const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  APP_NAME: z.string().default('atlas-api'),
  // Chat Model provider — see langchain/chat/create-chat-model.ts for the
  // extension pattern to add more providers (OpenAI, Gemini, etc.)
  CHAT_PROVIDER: z.enum(['groq']).default('groq'),
  // Groq (via @langchain/groq)
  GROQ_API_KEY: z.string().min(1, 'GROQ_API_KEY is required'),
  GROQ_MODEL: z.string().default('openai/gpt-oss-120b'),
  GROQ_TEMPERATURE: z.coerce.number().min(0).max(2).default(0.2),
  // Embeddings (local, via Transformers.js)
  LOCAL_EMBEDDING_MODEL: z.string().default('BAAI/bge-small-en-v1.5'),
  // Vector Store (Qdrant)
  QDRANT_URL: z.string().default('http://localhost:6333'),
  QDRANT_COLLECTION: z.string().default('knowledge'),
  // Redis — not provisioned by docker-compose.yml; point this at any
  // already-running Redis instance. Persists the BM25 lexical corpus built
  // by `knowledge:index` (see langchain/retrievers/bm25-corpus-store.ts) so
  // it survives process restarts instead of being rebuilt from
  // knowledge/*.md on every boot.
  REDIS_URL: z.string().default('redis://localhost:6379'),
  BM25_REDIS_KEY: z.string().default('atlas:bm25:corpus'),
  // Persists the parent-document docstore (see
  // langchain/retrievers/parent-document/) the same way — built by
  // `knowledge:index --target=parent-child`, only ever read at boot/query time.
  PARENT_DOCSTORE_REDIS_KEY: z.string().default('atlas:parent-docstore'),
  // Knowledge Indexing
  KNOWLEDGE_DIRECTORY: z.string().default(PATHS.knowledge),
  TEXT_CHUNK_SIZE: z.coerce.number().int().min(1).default(500),
  TEXT_CHUNK_OVERLAP: z.coerce.number().int().min(1).default(100),
  INDEX_BATCH_SIZE: z.coerce.number().int().min(1).default(100),
  // Retrieval (Phase 1 — dense baseline)
  RETRIEVAL_TOP_K: z.coerce.number().int().min(1).default(4),
  RETRIEVAL_SCORE_THRESHOLD: z.coerce.number().min(0).max(1).default(0.5),

  // Retrieval (Phase 2 — Advanced RAG) — see langchain/retrieval/create-advanced-retriever.ts
  // for how these compose into a strategy pipeline.
  RETRIEVAL_STRATEGY: z
    .enum(['dense', 'hybrid', 'multi_query', 'self_query', 'parent_document'])
    .default('dense'),
  RETRIEVAL_FETCH_K: z.coerce.number().int().min(1).default(20),

  // Hybrid search: dense + BM25, fused via Reciprocal Rank Fusion (RRF)
  RETRIEVAL_HYBRID_DENSE_WEIGHT: z.coerce.number().min(0).max(1).default(0.5),
  RETRIEVAL_RRF_K: z.coerce.number().int().min(1).default(60),

  // MMR (Maximal Marginal Relevance) — diversity-aware re-selection
  RETRIEVAL_MMR_ENABLED: booleanFlag(false),
  RETRIEVAL_MMR_LAMBDA: z.coerce.number().min(0).max(1).default(0.5),
  RETRIEVAL_MMR_FETCH_K: z.coerce.number().int().min(1).default(20),

  // Cross-encoder reranking (local, via Transformers.js)
  RETRIEVAL_RERANK_ENABLED: booleanFlag(false),
  RETRIEVAL_RERANK_MODEL: z.string().default('Xenova/ms-marco-MiniLM-L-6-v2'),
  RETRIEVAL_RERANK_TOP_N: z.coerce.number().int().min(1).default(4),

  // Context compression (EmbeddingsFilter — drops chunks below a similarity bar)
  RETRIEVAL_COMPRESSION_ENABLED: booleanFlag(false),
  RETRIEVAL_COMPRESSION_SIMILARITY_THRESHOLD: z.coerce.number().min(0).max(1).default(0.6),

  // Query expansion (single LLM-expanded query, applied before dense/hybrid retrieval)
  RETRIEVAL_QUERY_EXPANSION_ENABLED: booleanFlag(false),

  // Multi-query retrieval (LLM generates N query variants, results are merged)
  RETRIEVAL_MULTI_QUERY_COUNT: z.coerce.number().int().min(1).default(3),

  // Parent document retrieval — separate child-chunk collection + in-memory parent store
  KNOWLEDGE_PARENT_COLLECTION: z.string().default('knowledge_parent_child'),
  PARENT_CHUNK_SIZE: z.coerce.number().int().min(1).default(2000),
  PARENT_CHUNK_OVERLAP: z.coerce.number().int().min(0).default(200),
  CHILD_CHUNK_SIZE: z.coerce.number().int().min(1).default(400),
  CHILD_CHUNK_OVERLAP: z.coerce.number().int().min(0).default(50),

  // Memory (Phase 3) — conversation persistence (Redis), token budgeting,
  // context trimming, and rolling summarization. See
  // docs/phases/phase-3-memory.md.
  MEMORY_HISTORY_REDIS_PREFIX: z.string().default('atlas:chat:messages'),
  MEMORY_SUMMARY_REDIS_PREFIX: z.string().default('atlas:chat:summary'),
  MEMORY_HISTORY_TTL_SECONDS: z.coerce.number().int().min(1).default(604800), // 7 days, sliding

  // Token budgeting — defaults match openai/gpt-oss-120b's real context
  // window / max completion length on Groq. There's no per-model lookup
  // table, so override these if GROQ_MODEL changes to a smaller-context model.
  MEMORY_MAX_CONTEXT_TOKENS: z.coerce.number().int().min(1).default(131072),
  MEMORY_RESERVED_OUTPUT_TOKENS: z.coerce.number().int().min(1).default(8192),

  // Conversation summarization — deliberately low trigger so the mechanism
  // is observable in a short demo conversation, not just unreachable code
  // (see docs/phases/phase-3-memory.md §3's callout).
  MEMORY_RECENT_MESSAGES_KEPT: z.coerce.number().int().min(1).default(6),
  MEMORY_SUMMARY_TRIGGER_TOKENS: z.coerce.number().int().min(1).default(2000),

  // Semantic / vector memory — off by default (adds one LLM call per turn
  // for fact extraction, plus one retrieval call per turn when enabled)
  MEMORY_SEMANTIC_ENABLED: booleanFlag(false),
  MEMORY_SEMANTIC_COLLECTION: z.string().default('atlas_semantic_memory'),
  MEMORY_SEMANTIC_TOP_K: z.coerce.number().int().min(1).default(3),
  MEMORY_SEMANTIC_SCORE_THRESHOLD: z.coerce.number().min(0).max(1).default(0.5),

  // Prompt Engineering (Phase 4) — versioned prompt registry (Redis, same
  // instance as Memory above), dynamic prompt selection, few-shot, structured
  // output, and guardrails. See docs/phases/phase-4-prompt-engineering.md.
  PROMPT_REDIS_PREFIX: z.string().default('atlas:prompts:'),
  PROMPT_DEFAULT_TEMPLATE_ID: z.string().default('default'),

  // Guardrails — "block" short-circuits before the LLM call when an input
  // check fails; "observe" always generates normally and only reports
  // results. Output-side checks are always observe-only (see §5).
  PROMPT_GUARDRAILS_MODE: z.enum(['block', 'observe']).default('block'),
  PROMPT_GUARDRAILS_BLOCKED_TERMS: z
    .string()
    .default('kill someone,make a bomb,how to hack')
    .transform((value) =>
      value
        .split(',')
        .map((term) => term.trim().toLowerCase())
        .filter(Boolean),
    ),

  // Tools (Phase 5) — LangChain tool-calling (bindTools). See
  // docs/phases/phase-5-tools.md.
  //
  // Bounds the decide -> execute -> feed-results-back loop in
  // ChatService — a runaway-loop guard, not a reasoning depth knob (that's
  // Phase 6's job).
  TOOLS_MAX_ITERATIONS: z.coerce.number().int().min(1).default(3),
  // Per-tool-call timeout — one slow/hung tool (e.g. the weather tool's
  // network calls) degrades that single call to an error instead of
  // hanging the whole turn.
  TOOLS_EXECUTION_TIMEOUT_MS: z.coerce.number().int().min(1).default(10000),
  // Weather tool — Open-Meteo, free and keyless (no GROQ_API_KEY-style
  // secret needed).
  TOOLS_WEATHER_GEOCODING_URL: z.string().default('https://geocoding-api.open-meteo.com/v1/search'),
  TOOLS_WEATHER_FORECAST_URL: z.string().default('https://api.open-meteo.com/v1/forecast'),
  // file_search tool's own top-k for its explicit, model-triggered
  // re-query — separate from RETRIEVAL_TOP_K's always-on context injection.
  TOOLS_FILE_SEARCH_TOP_K: z.coerce.number().int().min(1).default(4),

  // Agents (Phase 6) — a classic text-based ReAct loop (Thought / Action /
  // Action Input / Observation, hand-parsed — deliberately not bindTools),
  // reusing Phase 5's ToolExecutor for actual tool execution. See
  // docs/phases/phase-6-agents.md.
  //
  // Bounds the ReAct ask -> parse -> act -> observe loop — a separate knob
  // from TOOLS_MAX_ITERATIONS since this is a conceptually different loop
  // (explicit reasoning steps, not native tool_calls).
  AGENT_MAX_STEPS: z.coerce.number().int().min(1).default(6),
  // Max steps the upfront plan (generatePlan()) may propose, before the
  // ReAct loop even starts.
  AGENT_PLAN_MAX_STEPS: z.coerce.number().int().min(1).default(5),

  // LangGraph (Phase 7) — an explicit StateGraph (agent -> tools loop,
  // native bindTools) replacing the hand-rolled shapes above with real
  // state, conditional routing, checkpoints, and human-in-the-loop
  // interrupt/resume. See docs/phases/phase-7-langgraph.md.
  //
  // Bounds the agent<->tools loop — a separate knob from AGENT_MAX_STEPS/
  // TOOLS_MAX_ITERATIONS, since this is yet another conceptually distinct
  // loop mechanism.
  AGENT_GRAPH_MAX_STEPS: z.coerce.number().int().min(1).default(6),
  // Tool names that must route through the `human_approval` node before
  // executing — everything else goes straight to `tools`. Comma-separated;
  // defaults to just the database tool (`order_lookup`).
  AGENT_GRAPH_APPROVAL_TOOLS: z
    .string()
    .default('order_lookup')
    .transform((value) =>
      value
        .split(',')
        .map((name) => name.trim())
        .filter(Boolean),
    ),
  // TTL for the Redis-backed checkpointer (`@langchain/langgraph-checkpoint-redis`)
  // — bounds how long a paused-awaiting-approval run's state lingers in
  // Redis if nobody ever resumes it.
  GRAPH_CHECKPOINT_TTL_MINUTES: z.coerce.number().int().min(1).default(60),

  // Multi-Agent (Phase 8) — a LangGraph "supervisor" graph: a coordinator
  // node dynamically routes between planner/researcher/writer/reviewer
  // specialists over shared blackboard state, no human-in-the-loop. See
  // docs/phases/phase-8-multi-agent.md.
  //
  // Bounds the coordinator's routing loop — a separate knob from
  // AGENT_GRAPH_MAX_STEPS since this is yet another conceptually distinct
  // loop (routing between specialists, not agent<->tools).
  MULTI_AGENT_MAX_ROUNDS: z.coerce.number().int().min(1).default(10),
  // Per-visit tool-call cap for the researcher node — separate knob from
  // TOOLS_MAX_ITERATIONS/AGENT_GRAPH_MAX_STEPS, same "separate loop,
  // separate knob" convention.
  MULTI_AGENT_RESEARCHER_MAX_TOOL_CALLS: z.coerce.number().int().min(1).default(3),
  // TTL for the multi-agent graph's own Redis-backed checkpointer — a
  // separate RedisSaver instance from Phase 7's (own TTL, own thread-id
  // namespace) so the two graphs' checkpoints can never collide.
  MULTI_AGENT_CHECKPOINT_TTL_MINUTES: z.coerce.number().int().min(1).default(60),
});

//validate environment variables
const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ Invalid environment variables');
  console.error(z.flattenError(parsedEnv.error));

  throw new Error('Invalid environment variables.');
}

export const env = Object.freeze(parsedEnv.data);
