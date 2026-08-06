import type { Embeddings } from '@langchain/core/embeddings';
import { QdrantVectorStore } from '@langchain/qdrant';
import { QdrantClient } from '@qdrant/js-client-rest';

import { env } from '@/config/env.js';

export interface CreateQdrantVectorStoreOptions {
  embeddings: Embeddings;
}

export async function createQdrantVectorStore({
  embeddings,
}: CreateQdrantVectorStoreOptions): Promise<QdrantVectorStore> {
  const client = new QdrantClient({
    url: env.QDRANT_URL,
  });

  return await QdrantVectorStore.fromExistingCollection(embeddings, {
    client,
    collectionName: env.QDRANT_COLLECTION,
  });
}
