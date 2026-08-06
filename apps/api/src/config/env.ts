import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

//load environment variables from .env file into process.env
loadEnv();

//define environment variables schema
const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  APP_NAME: z.string().default('atlas-api'),
  // Chat Provider (Groq/OpenAI compatible)
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-5'),
  OPENAI_BASE_URL: z.string().optional(),
  // Embedding Provider (DeepInfra)
  LOCAL_EMBEDDING_MODEL: z.string().default('BAAI/bge-small-en-v1.5'),
  // Vector Store (Qdrant)
  QDRANT_URL: z.string().default('http://localhost:6333'),
  QDRANT_COLLECTION: z.string().default('knowledge'),
  KNOWLEDGE_DIRECTORY: z.string().default('knowledge'),
  TEXT_CHUNK_SIZE: z.coerce.number().int().min(1).default(500),
  TEXT_CHUNK_OVERLAP: z.coerce.number().int().min(1).default(100),
  INDEX_BATCH_SIZE: z.coerce.number().int().min(1).default(100),
});

//validate environment variables
const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ Invalid environment variables');
  console.error(z.flattenError(parsedEnv.error));

  throw new Error('Invalid environment variables.');
}

export const env = Object.freeze(parsedEnv.data);
