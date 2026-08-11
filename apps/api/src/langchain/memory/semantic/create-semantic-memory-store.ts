import type { Embeddings } from '@langchain/core/embeddings';
import { QdrantVectorStore } from '@langchain/qdrant';
import { QdrantClient } from '@qdrant/js-client-rest';

import { env } from '@/config/env.js';
import { embeddingConfiguration } from '@/langchain/embeddings/index.js';
import { QdrantCollectionService } from '@/langchain/vectorstores/index.js';

export interface CreateSemanticMemoryStoreOptions {
  embeddings: Embeddings;
}

/**
 * Connects to `MEMORY_SEMANTIC_COLLECTION`, creating it on first use.
 *
 * Unlike the knowledge collections (Phase 2 §2.4, CLI-only, never built by
 * the app), semantic memory has no batch-ingestion step — facts are written
 * continuously as a side effect of live conversations (§9.2), so there's
 * nothing for a `knowledge:index`-style command to build ahead of time.
 * `ensureCollection()` is a no-op after the first call.
 */
export async function createSemanticMemoryStore({
  embeddings,
}: CreateSemanticMemoryStoreOptions): Promise<QdrantVectorStore> {
  const collections = new QdrantCollectionService();

  await collections.ensureCollection({
    name: env.MEMORY_SEMANTIC_COLLECTION,
    dimensions: embeddingConfiguration.dimensions,
  });

  const client = new QdrantClient({ url: env.QDRANT_URL });

  return QdrantVectorStore.fromExistingCollection(embeddings, {
    client,
    collectionName: env.MEMORY_SEMANTIC_COLLECTION,
  });
}
