import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

import { PATHS } from './paths.js';

//load environment variables from .env file into process.env
loadEnv();

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
  // Knowledge Indexing
  KNOWLEDGE_DIRECTORY: z.string().default(PATHS.knowledge),
  TEXT_CHUNK_SIZE: z.coerce.number().int().min(1).default(500),
  TEXT_CHUNK_OVERLAP: z.coerce.number().int().min(1).default(100),
  INDEX_BATCH_SIZE: z.coerce.number().int().min(1).default(100),
  // Retrieval
  RETRIEVAL_TOP_K: z.coerce.number().int().min(1).default(4),
  RETRIEVAL_SCORE_THRESHOLD: z.coerce.number().min(0).max(1).default(0.5),
});

//validate environment variables
const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ Invalid environment variables');
  console.error(z.flattenError(parsedEnv.error));

  throw new Error('Invalid environment variables.');
}

export const env = Object.freeze(parsedEnv.data);
