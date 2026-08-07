import { env } from '@/config/env.js';

export const embeddingConfiguration = {
  model: env.LOCAL_EMBEDDING_MODEL,
  dimensions: 384,
} as const;
