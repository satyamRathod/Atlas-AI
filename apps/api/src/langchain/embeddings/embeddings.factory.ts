import type { Embeddings } from '@langchain/core/embeddings';
import { env } from '@/config/env.js';

import { TransformersEmbeddings } from './transformers.embeddings.js';

export function createEmbeddings(): Embeddings {
  return new TransformersEmbeddings({
    model: env.LOCAL_EMBEDDING_MODEL,
  });
}
