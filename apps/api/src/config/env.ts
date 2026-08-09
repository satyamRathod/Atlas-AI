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
});

//validate environment variables
const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ Invalid environment variables');
  console.error(z.flattenError(parsedEnv.error));

  throw new Error('Invalid environment variables.');
}

export const env = Object.freeze(parsedEnv.data);
